import { ComponentType } from "react";
import { useSignals, useSignalEffect } from "@preact/signals-react/runtime";
import { LoadingDots } from "@storyteller/ui-loading";
import { persistLogin } from "~/signals";
import { TWO_SECONDS } from "~/constants";

export const withProtectionRoute = <P extends object>(
  Component: ComponentType<P>,
) =>
  function ProtectionRoute(rest: P) {
    useSignals();
    useSignalEffect(() => {
      persistLogin();
    });

    // const { status, userInfo } = authentication;
    // //render according to auth status
    // if (
    //   status.value === AUTH_STATUS.INIT ||
    //   status.value === AUTH_STATUS.LOGGING ||
    //   status.value === AUTH_STATUS.GET_USER_INFO
    // ) {
    //   return (
    //     <div className="fixed flex h-full w-full flex-col  items-center justify-center">
    //       <LoadingDots type="bricks" message="Authentication in Process..." />
    //     </div>
    //   );
    // }

    // if (
    //   status.value === AUTH_STATUS.LOGGED_IN &&
    //   userInfo.value &&
    //   userInfo.value.can_access_studio
    // ) {
    return <Component {...rest} />; // uncomment everything else this gives the component to render.
    // }

    // return <RedirectToLogin />;
  };
