from fastapi import Request
from fastapi.responses import JSONResponse
from exceptions import CustomError, CustomException
from starlette.middleware.base import BaseHTTPMiddleware
from src.utils.logger import logger
import json


class ResponseMiddleware(BaseHTTPMiddleware):
    """统一响应处理中间件
    功能：
    1. 统一处理业务正常响应，添加code和message字段
    2. 统一处理异常，返回标准错误格式
    """

    async def dispatch(self, request: Request, call_next):
        # 提前初始化 lang 变量，确保在异常处理中可用
        lang = 'zh'  # 默认语言
        
        # Build CORS header for this request's origin (mirrors CORSMiddleware logic).
        # We need to carry these through any JSONResponse we create ourselves so
        # that the browser doesn't block the response.
        origin = request.headers.get("origin", "")
        cors_headers: dict[str, str] = {}
        if origin:
            cors_headers["access-control-allow-origin"] = origin
            cors_headers["access-control-allow-credentials"] = "true"
            cors_headers["vary"] = "Origin"

        try:
            lang = self._get_language_from_request(request)
            response = await call_next(request)

            # 处理非200状态码的响应
            if response.status_code != 200:
                return await self._handle_non_200_response(response, lang, cors_headers)
                
            # 处理JSON响应
            if self._is_json_response(response):
                return await self._process_json_response(response, lang, cors_headers)
                
            return response
            
        except CustomException as e:
            return self._handle_custom_exception(e, lang, cors_headers)
        except Exception as e:
            return self._handle_generic_exception(e, lang, cors_headers)

    def _get_language_from_request(self, request: Request) -> str:
        """从请求头获取语言偏好"""
        try:
            # 安全地解析 Accept-Language 头
            accept_lang = request.headers.get('Accept-Language', 'zh')
            if not accept_lang or not accept_lang.strip():
                return 'zh'
            
            # 先按逗号分割，取第一部分
            lang_parts = accept_lang.split(',')[0].strip()
            if not lang_parts:
                return 'zh'
            
            # 再按连字符分割，取语言代码部分
            lang_code_parts = lang_parts.split('-')
            if not lang_code_parts or not lang_code_parts[0]:
                return 'zh'
            
            lang = lang_code_parts[0].lower()
            return lang if lang in ['zh', 'en'] else 'zh'
            
        except Exception:
            # 如果解析过程中出现任何异常，返回默认语言
            return 'zh'
    
    def _handle_422_error(self, body_str: str, lang: str, cors_headers: dict | None = None) -> JSONResponse:
        """特殊处理422参数验证错误"""
        cors_headers = cors_headers or {}
        try:
            # 尝试解析422错误的响应体
            error_data = json.loads(body_str)
            
            # 提取验证错误的详细信息
            validation_messages = []
            if "detail" in error_data:
                for error in error_data["detail"]:
                    if "loc" in error and "msg" in error:
                        # 格式化错误信息
                        field = ".".join(str(part) for part in error["loc"] if part != "body")
                        message = f"{field}: {error['msg']}"
                        validation_messages.append(message)

            # 构建统一的422错误响应（不包含data字段）
            error_message = "; ".join(validation_messages) if validation_messages else ""
            error_response = CustomError.PARAM_VALIDATION_FAILED.as_dict(detail=error_message, lang=lang)
            resp = JSONResponse(status_code=200, content=error_response)
            resp.headers.update(cors_headers)
            return resp
            
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse 422 response body: {body_str}")
            
            error_response = CustomError.PARAM_VALIDATION_FAILED.as_dict(detail=body_str, lang=lang)
            resp = JSONResponse(status_code=200, content=error_response)
            resp.headers.update(cors_headers)
            return resp

    async def _handle_non_200_response(self, response, lang: str, cors_headers: dict | None = None) -> JSONResponse:
        """处理非200状态码的响应"""
        cors_headers = cors_headers or {}
        body = b""
        async for chunk in response.body_iterator:
            body += chunk
        
        body_str = body.decode()

        # 特殊处理422错误（参数验证错误）
        if response.status_code == 422:
            return self._handle_422_error(body_str, lang, cors_headers)
        
        # 其它情况不应该发生，每一个错误都应该在前面被处理
        logger.error(f"Non-200 response: {response.status_code} - {body_str}")
        # 其他非200错误处理
        error_response = {
            "code": response.status_code,
            "message": f"HTTP Error {response.status_code}, detail: {body_str}"
        }
        resp = JSONResponse(status_code=200, content=error_response)
        resp.headers.update(cors_headers)
        return resp

    def _is_json_response(self, response) -> bool:
        """检查是否为JSON响应"""
        return response.headers.get('content-type') == 'application/json'

    async def _process_json_response(self, response, lang: str, cors_headers: dict | None = None):
        """处理JSON响应并统一格式"""
        body = [section async for section in response.body_iterator]
        if not body:
            return response
            
        body_str = b''.join(body).decode()
        
        # Copy CORS / hop-by-hop headers từ response gốc sang response mới.
        # Khi middleware tạo JSONResponse mới, CORSMiddleware headers (do FastAPI
        # thêm vào response gốc) bị mất — gây CORS block ở browser.
        _CORS_HEADERS = (
            "access-control-allow-origin",
            "access-control-allow-credentials",
            "access-control-allow-methods",
            "access-control-allow-headers",
            "access-control-expose-headers",
            "access-control-max-age",
            "vary",
        )
        # Merge: caller-provided cors_headers (from request origin) take priority.
        # Also copy any CORS headers already on the response (set by CORSMiddleware).
        resp_cors = {
            k: v
            for k, v in response.headers.items()
            if k.lower() in _CORS_HEADERS
        }
        merged_cors: dict[str, str] = {**resp_cors, **(cors_headers or {})}

        try:
            data = json.loads(body_str)
            
            # 如果响应已经有统一格式，重建 JSONResponse 保留 CORS headers
            if 'code' in data and 'message' in data:
                new_resp = JSONResponse(
                    status_code=response.status_code,
                    content=data,
                )
                new_resp.headers.update(merged_cors)
                return new_resp
                
            # 创建统一格式的响应（成功响应保留data字段）
            unified_response = {
                'code': CustomError.SUCCESS.code,
                'message': CustomError.SUCCESS.as_dict(lang=lang)['message'],
                **data
            }
            
            new_resp = JSONResponse(
                status_code=response.status_code,
                content=unified_response,
            )
            new_resp.headers.update(merged_cors)
            return new_resp
            
        except json.JSONDecodeError:
            logger.warning(f"JSON decode error: {body_str}")
            return response


    def _handle_custom_exception(self, e: CustomException, lang: str, cors_headers: dict | None = None) -> JSONResponse:
        """处理自定义异常（不包含data字段）"""
        cors_headers = cors_headers or {}
        logger.warning(f"Custom exception: {e.err.code} - {e.err.cn_message}" + 
                    (f" ({e.detail})" if e.detail else ""))
        
        # 获取错误信息
        error_response = e.err.as_dict(detail=e.detail, lang=lang)
        resp = JSONResponse(status_code=200, content=error_response)
        resp.headers.update(cors_headers)
        return resp

    def _handle_generic_exception(self, e: Exception, lang: str, cors_headers: dict | None = None) -> JSONResponse:
        """处理通用异常（不包含data字段）"""
        cors_headers = cors_headers or {}
        logger.warning(f"Internal server error: {str(e)}")
        
        # 获取错误信息
        error_response = CustomError.INTERNAL_SERVER_ERROR.as_dict(detail=str(e), lang=lang)
        resp = JSONResponse(status_code=200, content=error_response)
        resp.headers.update(cors_headers)
        return resp