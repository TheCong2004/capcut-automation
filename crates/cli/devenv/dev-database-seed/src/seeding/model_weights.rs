use std::path::PathBuf;
use std::vec;

use log::info;
use sqlx::{MySql, Pool};

use bucket_paths::legacy::remote_file_manager_paths::weights_descriptor::{WeightsLoRADescriptor, WeightsSD15Descriptor, WeightsWorkflowDescriptor};
use bucket_paths::legacy::remote_file_manager_paths::remote_cloud_bucket_details::RemoteCloudBucketDetails;
use cloud_storage::remote_file_manager::remote_cloud_file_manager::RemoteCloudFileClient;
use enums::by_table::model_weights::{
    weights_category::WeightsCategory,
    weights_types::WeightsType,
};
use enums::common::visibility::Visibility;
use errors::{anyhow, AnyhowResult};
use mysql_queries::queries::model_weights::create::create_weight::{create_weight, CreateModelWeightsArgs};
use mysql_queries::queries::users::user::get::get_user_token_by_username::get_user_token_by_username;
use storyteller_root::get_seed_tool_data_root;
use tokens::tokens::model_weights::ModelWeightToken;
use tokens::tokens::users::UserToken;

use crate::seeding::users::HANASHI_USERNAME;

pub async fn test_seed_weights_files() -> AnyhowResult<()> {

    let seed_path = PathBuf::from("/storyteller/root/custom-seed-tool-data");
    let remote_cloud_file_client = RemoteCloudFileClient::get_remote_cloud_file_client().await;
    let remote_cloud_file_client = match remote_cloud_file_client {
        Ok(res) => {
            res
        }
        Err(_) => {
            return Err(anyhow!("failed to get remote cloud file client"));
        }
    };

    let mut path_dl1 = seed_path.clone();
    path_dl1.push("downloads/loRA");
    let mut path_dl2 = seed_path.clone();
    path_dl2.push("downloads/checkpoint");

    let bucket_details1 = RemoteCloudBucketDetails {
        object_hash: String::from("apa0ej6es8d3ss2gwtf1cghge35qn9tn"),
        prefix: String::from("sd15_"),
        suffix: String::from(".safetensors"),
    };

    let bucket_details2 = RemoteCloudBucketDetails {
        object_hash: String::from("27kz11et18fargyyxbj66ntfn621k9d3"),
        prefix: String::from("loRA_"),
        suffix: String::from(".safetensors"),
    };

    remote_cloud_file_client.download_file(bucket_details1, String::from("./checkpoint")).await?;
    remote_cloud_file_client.download_file(bucket_details2, String::from("./loRA")).await?;

    Ok(())
}

pub async fn seed_weights_for_paging(mysql_pool: &Pool<MySql>, user_token: UserToken) -> AnyhowResult<()> {
    let sd1_5_markdown_description = r#"
# Dragonfruit AI Models Update and Workflow

## Last Update for Dragonfruit Models
- **Note:** This might be the last update for a while, focusing next on a realistic merge (WIP).
- **Future Plans:** Possible update to Z.5D v2 after completing the realistic merge.

## New Models Announcement
- **Upcoming Models:** Separate from the Dragonfruit branch, so stay tuned!

## DragonfruitGT v1 (Z v2)
- **Focus:** More fantasy, richer color range, improved landscapes, more masculine men.
- **Alternative:** Use DragonfruitOG v2.0 for thicker lines, simpler colors.

## GT v1.0 (Z v2.0) Features
- Improved backgrounds
- Deeper contrast and color
- Bolder lines and more detail

### Settings for GT
- Steps: 30-50
- Clip skip: 2
- Upscaler: Euler a / DPM++ 2M SDE Karras
- Extensions: Adetailer, VAE: berrysmix

## Workflow for Images
1. **BerryMix VAE:** Ensure correct color.
2. **Adetailer Extension:** Improve faces, bodies, and hands. Also available on Civitai and Huggingface.
3. **Hires Fix:** Denoising strength 0.3 - 0.35, using upscaler "x_NMKD-Superscale-SP_178000_G".
4. **Img2img Transfer:** Use denoising strength 0.3-0.35 with the same prompt and settings. Adjust height after hires.
5. **Second Img2img Transfer:** Low denoising strength 0.1-3.0. Use SD upscale script with "RealESRGAN_x4plus_anime_6B" sampler for size increase.

## DragonfruitZ.5D v1.0
- **Style:** 2.5D model, merging DragonfruitZ with realistic elements.
- **Features:** Skin color variety, masculine men, landscapes, fantasy, NSFW content, detailed faces.

### Settings for Z.5D
- Steps: 30
- Clip skip: 2
- Upscaler: Euler a
- Extensions: Adetailer, VAE: berrysmix

## DragonfruitOG v2.0
- **Refinement:** Of the original Dragonfruit model.
- **Style:** Bold, clean lines and bold colors with decreased detail for simplicity.
- **Improvements:** Teeth, skin color variety, landscapes, fantasy elements, NSFW content.

## DragonfruitZ v1.0
- **Alternative Version:** More fantasy and color range, better landscapes, more masculine men.
- **Suggestion:** Use Dragonfruit (Unisex) v2 for thicker lines and simpler colors.

## Dragonfruit OG v1.0
- **Focus:** More unisex, suitable for creating male characters.
- **Personal Note:** First merge, aimed at 2D, flat, colorful, thick lined styles.

### Personal Settings
- Steps: 20-30
- Clip skip: 2
- Upscaler: Euler a / DPM++ 2M SDE Karras
- Extensions: Adetailer, VAE: berrysmix

*Thank you for your continued support and feedback!*
"#;

    let _sd1_5_image_token = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/be706282-2978-42a0-aaa2-73881aad94e9/width=1024/00049-2287632957-1girl,face,curly%20hair,red%20hair,white%20background,.jpeg";

    // create a loop that loops from 1 to 100
    for i in 1..=100 {
        // create a new weight
        
        let weights_category = match i {
            1..=20 => WeightsCategory::VoiceConversion,
            21..=40 => WeightsCategory::TextToSpeech,
            41..=60 => WeightsCategory::ImageGeneration,
            61..=80 => WeightsCategory::ImageGeneration,
            81..=100 => WeightsCategory::ImageGeneration,
            _ => WeightsCategory::ImageGeneration
        };

        let weights_types = match i {
            1..=20 => WeightsType::RvcV2,
            21..=40 => WeightsType::HifiganTacotron2,
            41..=60 => WeightsType::StableDiffusion15,
            61..=80 => WeightsType::StableDiffusionXL,
            81..=100 => WeightsType::LoRA,
            _ => WeightsType::LoRA
        };

        let model_weight_token;
        let title;
        let description;
        let description_rendered_html;
        let original_filename;
        let original_download_url;

        let _private_bucket_hash = "".to_string();
        let private_bucket_prefix;
        let private_bucket_extension;

        //let mut cached_user_ratings_total_count;
        //let mut cached_user_ratings_positive_count;
        //let mut cached_user_ratings_negative_count;
        //let mut cached_user_ratings_ratio;
        let version;

        match i {
            1..=20 => {
                // voice conversion model
                let rvc_markdown_description = r#"
                # RVC v2
                - **Improved Quality:** The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.
                - Gawr Gura MOS 4
                "#;

                model_weight_token = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
                title = format!("Gawr Gura: {}", i);
                description = format!("Description Number {} The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.", i);
                description_rendered_html = rvc_markdown_description;
                
                original_filename = format!("gura_gwar{}.safetensors", i);
                original_download_url = format!("www.google.ca");

                // private_bucket_hash = format!("bucket_hash{}", i);
                private_bucket_prefix = format!("_fake");
                private_bucket_extension = format!("rvcV2");
                //cached_user_ratings_total_count = i;
                //cached_user_ratings_positive_count = i;
                //cached_user_ratings_negative_count = i;
                //cached_user_ratings_ratio = i as u32 / 100;
                version = i as i32;
                println!("Seeding RVCv2 model {}", i);
            },
            21..=40 =>{
                // TTS
                model_weight_token = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
                title = format!("dragonfruitGTv1: {}", i);
                
                description = format!("Description Number {}:", i);
            
                let tts_markdown_description = r#"
                # HifiGAN Tacotron2
                - **Improved Quality:** The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.
                - Goku MOS 4
                "#;

                description_rendered_html = tts_markdown_description;
                
                original_filename = format!("filename{}.txt", i);
                original_download_url = format!("https://civitai.com/api/download/models/149193?type=Model&format=SafeTensor&size=pruned&fp=fp16");

                // private_bucket_hash = format!("bucket_hash{}", i);
                private_bucket_prefix = format!("_fake");
                private_bucket_extension = format!("tt2");

                //cached_user_ratings_total_count = i;
                //cached_user_ratings_positive_count = i;
                //cached_user_ratings_negative_count = i;
                //cached_user_ratings_ratio = i as u32 / 100;
                version = i as i32;
                println!("Seeding TT2 model {}", i);
            },
            41..=60 => {
                // SD 1.5
                model_weight_token = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
                title = format!("dragonfruitGTv1: {}", i);
                
                description = format!("Description Number {}:", i);
                
                description_rendered_html = sd1_5_markdown_description;
                
                original_filename = format!("filename{}.txt", i);
                original_download_url = format!("https://civitai.com/api/download/models/149193?type=Model&format=SafeTensor&size=pruned&fp=fp16");

                // private_bucket_hash = format!("bucket_hash{}", i);
                private_bucket_prefix = format!("_fake");
                private_bucket_extension = format!("sd15");

                //cached_user_ratings_total_count = i;
                //cached_user_ratings_positive_count = i;
                //cached_user_ratings_negative_count = i;
                //cached_user_ratings_ratio = i as u32 / 100;
                version = i as i32;
                println!("Seeding SD15 model {}", i);
            },
            61..=80 => {
                // SD XL
                let sdxl_markdown_description = r#"
                # Special Edition Release Announcement

                ## What's New?
                - **Improved Quality:** The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.

                ## Tips for Use
                1. **Simple Prompts:** Avoid adding words like "detailed, realistic..." or specifying a specific artist. Simply describe what you want to see.
                2. **CFG Scale:** A range between 3 and 8.5 is effective (recommended: 7).
                3. **Minimum Steps:** Ensure at least 36 steps for optimal results.
                4. **Compatibility:**
                - Works excellently with Hires fix.
                - Great results with unaestheticXLv31 embedding, although sometimes better without it.
                5. **Sampling Method:** Either DPM++ 2M SDE Karras or DPM++ 2M Karras.

                Have fun! 😊
                "#;
                let _sdxl_image_token = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/be706282-2978-42a0-aaa2-73881aad94e9/width=1024/00049-2287632957-1girl,face,curly%20hair,red%20hair,white%20background,.jpeg";

                model_weight_token = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
                title = format!("SDXL_Niji_Special Edition: {}", i);
                description = format!("Description Number {}:", i);

                // private_bucket_hash = format!("bucket_hash{}", i);
                private_bucket_prefix = format!("_fake");
                private_bucket_extension = format!("sdxl");
  
                description_rendered_html = sdxl_markdown_description;
                  
                original_filename = format!("filename{}.txt", i);
                original_download_url = format!("https://civitai.com/api/download/models/149193?type=Model&format=SafeTensor&size=pruned&fp=fp16");
  
                //cached_user_ratings_total_count = i;
                //cached_user_ratings_positive_count = i;
                //cached_user_ratings_negative_count = i;
                //cached_user_ratings_ratio = i as u32 / 100;
                version = i as i32;
                println!("Seeding SDXL model {}", i);
            },
            81..=100 => {
                // LoRA
                let lora_markdown_description = r#"
                - **Improved Quality:** The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.
                - LoRA Gawr Gura
                "#;

                let _lora_image_token = "https://image.civitai.com/xG1nkqKTMzGDvpLrqFT7WA/123645df-dee2-4239-863a-76a150b09c32/width=1024/00000-2171948503.jpeg";
                model_weight_token = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
                title = format!("Gawr Gura LoRA: {}", i);
                
                description = format!("Description Number {}:", i);

                description_rendered_html = lora_markdown_description;
                
                original_filename = format!("filename{}.txt", i);
                original_download_url = format!("https://civitai.com/api/download/models/149193?type=Model&format=SafeTensor&size=pruned&fp=fp16");

                // private_bucket_hash = format!("bucket_hash{}", i);
                private_bucket_prefix = format!("_fake");
                private_bucket_extension = format!("loRA");

                //cached_user_ratings_total_count = i;
                //cached_user_ratings_positive_count = i;
                //cached_user_ratings_negative_count = i;
                //cached_user_ratings_ratio = i as u32 / 100;
                version = i as i32;
                println!("Seeding LoRA model {}", i);
            },
            _ => {
                // We went out of range so have more gwar gura
                let rvc_markdown_description = r#"
                # RVC v2
                - **Improved Quality:** The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.
                - Gawr Gura MOS 4
                "#;

                model_weight_token = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
                title = format!("Gawr Gura: {}", i);
                description = format!("Description Number {} The special edition offers significantly better quality with fewer issues. It's the model as initially envisioned.", i);
                description_rendered_html = rvc_markdown_description;
                
                original_filename = format!("gura_gwar{}.safetensors", i);
                original_download_url = format!("www.google.ca");

                // private_bucket_hash = format!("bucket_hash{}", i);
                private_bucket_prefix = format!("_fake");
                private_bucket_extension = format!("rvcV2");
                version = i as i32;

                println!("Out of range");
            }
        }
     
            let args = CreateModelWeightsArgs {
                token: &model_weight_token, // replace with actual ModelWeightToken
                weights_type: weights_types, // replace with actual WeightsType
                weights_category, // replace with actual WeightsCategory
                title,
                maybe_cover_image_media_file_token: None,
                maybe_description_markdown: Some(description),
                maybe_description_rendered_html: Some(description_rendered_html.to_string()),
                creator_user_token: Some(&user_token), // replace with actual UserToken
                creator_ip_address: "192.168.1.1",
                creator_set_visibility: Visibility::Public,
                maybe_last_update_user_token: Some(user_token.to_string()),
                original_download_url: Some(original_download_url),
                original_filename: Some(original_filename),
                file_size_bytes: 1024,
                file_checksum_sha2: "checksum1".to_string(),
                public_bucket_hash: "bucket_hash1".to_string(),
                maybe_public_bucket_prefix: Some(private_bucket_prefix),
                maybe_public_bucket_extension: Some(private_bucket_extension),
                //cached_user_ratings_total_count,
                //cached_user_ratings_positive_count,
                //cached_user_ratings_negative_count,
                //maybe_cached_user_ratings_ratio: Some(cached_user_ratings_ratio as f32),
                version: version as u32,
                mysql_pool: &mysql_pool, // replace with actual MySqlPool
            };
        
            create_weight(args).await;
        }
    Ok(())
}

pub async fn seed_weights_for_testing_inference(mysql_pool: &Pool<MySql>, user_token: UserToken) -> AnyhowResult<()>{


    let miyhoyo_description = r#"一个面向米哈游角色的模型合集~A collection for MIHOYO Characters~
对应人物tag记录在版本信息里，可在右侧“About this version”选项中查看。The corresponding character prompts are recorded in the version information and can be viewed in the About this version option on the right.
打开目录寻找最爱~（附带链接，点击直达）~Open the catalog, find your favorites~ (with links, click to go directly):
崩坏三 Honkai Impact 3rd：

梅比乌斯- Mobius

琪亚娜-Kiana：琪亚娜 合集-Collections for Kiana (Honkai Impact 3rd)

布洛妮娅-bronya：布洛妮娅 合集-Collections for Bronya (Honkai Impact 3rd | Honkai Star Rail)

芽衣：雷电芽衣 合集-Collections for Raiden Mei (Honkai Impact 3rd)

西琳-Sirin

魔法少女-Miracle ☆ Magical Girl

赤鸢-Jingwei

丹朱苍玄-Nuwa/Fuxi

李素裳-Li Sushang

玉骑士·月痕/锦岁玉团-Jade Knight/Auspicious Dazzle

卡莲-kallen

第六夜想曲-Sixth Serenade

符华-Fu hua

崩落

云墨丹心-Azure Empyrea

八重樱-Yae Sakura

逆神巫女-Gyakushinn Miko

御神装·勿忘-Goushinnso Memento

信花舞伎-Blooming Maiko

希尔-Seele

生死律者-Herrscher of Rebirth

栖于永夜-Eternal Night's Embrace

德莉莎-Theresa：德莉莎 合集-Collections for Theresa (Honkai Impact 3rd)

月下誓约-Lunar Vow: Crimson Love

月下初拥-Luna Kindred

花裳月纱-Rosy Bridesmaid

格蕾修-Griseo

繁星·绘世之卷-Starry Impression

天行·绘星之卷-Cosmic Expression

画中的童话-Maroon Riding Hood

原神 Genshin：

凝光-Ningguang

申鹤-Shenhe

妮露

诺艾尔

神里绫华（包含礼装）

甘雨(包含喜茶联动礼装)-Ganyu

胡桃(包含森罗联动礼装)-Hutao

琳妮特-Lynette

绮良良-Kirara

坎蒂丝-Candace

芙宁娜-Furina

芙宁娜/芙卡洛斯-Furina/Focalors

克洛琳德-Clorinde

娜维娅-Navia

丝柯克-Skirk

夏洛蒂-Charlotte

归终-Guizhong

闲云-Xianyun

千织-Chiori

夏沃蕾-Chevreuse

崩坏：星穹铁道 Honkai Star Rand：

驭空-Yukong

银狼-Silver Wolf

符玄-Fu Xuan

李素裳-Sushang

三月七(礼装)-March 7th (New Outfit)

停云-Tingyun

青雀-Qingque

布洛妮娅·兰德-Bronya Rand

镜流-Jingliu

卡芙卡-Kafka

托帕-Topaz

桂乃芬-Guinaifen

玲可-Lynx

佩拉-Peia

寒鸦-Hanya

藿藿-Huohuo

阮·梅-Ruan Mei

雪衣-Xueyi

希露瓦-Serval

绝区零 Zenless-zone-zero：

星见雅-Miyabi

猫宫又奈-Nekomata

艾莲·乔-Ellen

妮可-Nicole

苍角-Soukaku

格莉丝-Grace

珂蕾妲-koleda

可琳-Corin

其他 Others：

鹿鸣-Luming
    """#;

    let sd1_5_markdown_description = r#"
00025-2161235528-1girl,(orange_hair_1.1),(zentangle, mandala, tangle, entangle_0.6),(fractal art),the most beautiful form of chaos,brutalist desi.png


00010-1626070972-elf portrait,enchanting beauty,fantasy,ethereal glow,pointed ears,delicate facial features,long elegant hair,nature-themed attir.png


00001-301370162-girl in a snowy landscape,winter coat,fluffy hood,white fur trim,breath visible in cold air,soft falling snowflakes,glistening s.png


00002-3996269517-venomous sorcerer,ominous dark robes,glowing green eyes,holding a staff with a serpent design,mystical green flames,poisonous mi.png


00003-3817469732-Thunder Deity,immense power,hovering above the sea,stormy ocean waves below,crackling lightning in fingertips,dramatic stormy cl.png

if you want to remake my front image, check this out: Lightflow | SD webUI Extension - workflow restore & save in one click - majicMIXfantasy example | Stable Diffusion Other | Civitai

v3 is here. Shouldn't be difficult to use. Simple and complex prompts can be used, unleash your imagination.

v3来了，简单复杂的提示词都可以用。

I developed the v3 version towards 2D in order to make more room for 2.5D models like majicmix lux.

v3版本我往2D发展是为了给majicmix lux等2.5D模型让出更多空间。

merged from融了:
Jack Of All by GeneratedJudge

AWPainting by DynamicWang

majicMIX fantasy v2 =
Noosphere by skumerz + dalcefoPainting + 饭特稀V08 by zhazhahui345 + GhostMix
"#;


    let sd_vae_description = r"This is an earlier version of a stable VAE. Compared to other VAEs, it has a higher level of stability. I am not the creator, but I could not find this VAE on the website, so I am sharing it here.
这是较早时候的稳定VAE，与其他VAE相比具有较高的稳定性，不容易坏图。我不是作者，但是站里没找着所以搬运。#";


    info!("Seeding weights for inference...");
    ModelWeightToken::reset_rng_for_testing_and_dev_seeding_never_use_in_production_seriously(54321);
    let model_weight_token1 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let model_weight_token2 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let model_weight_token3 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();


    let remote_cloud_file_client = RemoteCloudFileClient::get_remote_cloud_file_client().await?;

    let sd_15_weights_descriptor = Box::new(WeightsSD15Descriptor {});
    let lora_descriptor = Box::new(WeightsLoRADescriptor{});
    let sd_vae_15_weights_descriptor = Box::new(WeightsSD15Descriptor {});

    let mut path_object_SD = get_seed_tool_data_root();
    path_object_SD.push("models/imagegen/sd15/majicmixFantasy_v30Vae.safetensors");

    let mut path_object_loRA = get_seed_tool_data_root();
    path_object_loRA.push("models/imagegen/loRA/xiawolei-v100-000019.safetensors");

    let mut path_to_VAE = get_seed_tool_data_root();
    path_to_VAE.push("models/imagegen/vae/zVae_v20.safetensors");

    let metadata1 = remote_cloud_file_client.upload_file(sd_15_weights_descriptor,path_object_SD.as_path().to_str().unwrap()).await?;
    let metadata2 = remote_cloud_file_client.upload_file(lora_descriptor,path_object_loRA.as_path().to_str().unwrap()).await?;
    let metadata3 = remote_cloud_file_client.upload_file(sd_vae_15_weights_descriptor,path_to_VAE.as_path().to_str().unwrap()).await?;

    let weights1 = CreateModelWeightsArgs {
        token: &model_weight_token1, // replace with actual ModelWeightToken
        weights_type: WeightsType::StableDiffusion15, // replace with actual WeightsType
        weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
        title: "Dragonfruit".to_string(),
        maybe_cover_image_media_file_token: None,
        maybe_description_markdown: Some(sd1_5_markdown_description.to_string()),
        maybe_description_rendered_html: Some("<p>Description</p>".to_string()),
        creator_user_token: Some(&user_token), // replace with actual UserToken
        creator_ip_address: "192.168.1.1",
        creator_set_visibility: Visibility::Public,
        maybe_last_update_user_token: Some("Last Update User Token".to_string()),
        original_download_url: Some("https://civitai.com/models/41865/majicmix-fantasy".to_string()),
        original_filename: Some("majicmixFantasy_v30Vae.safetensors".to_string()),
        file_size_bytes: metadata1.file_size_bytes,
        file_checksum_sha2: metadata1.sha256_checksum.to_string(),
        public_bucket_hash: metadata1.bucket_details.clone().unwrap().object_hash,
        maybe_public_bucket_prefix: Some(metadata1.bucket_details.clone().unwrap().prefix),
        maybe_public_bucket_extension: Some(metadata1.bucket_details.clone().unwrap().suffix),
        version: 1,
        mysql_pool: &mysql_pool, // replace with actual MySqlPool
    };

    let weights2  = CreateModelWeightsArgs {
        token: &model_weight_token2, // replace with actual ModelWeightToken
        weights_type: WeightsType::LoRA, // replace with actual WeightsType
        weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
        maybe_cover_image_media_file_token: None,
        title: "MIHOYO Collection 米家全家桶 (Honkai Impact 3rd | Honkai Star Rail | Genshin Impact | Zenless Zone Zero)".to_string(),
        maybe_description_markdown: Some(miyhoyo_description.to_string()),
        maybe_description_rendered_html: Some(miyhoyo_description.to_string()),
        creator_user_token: Some(&user_token), // replace with actual UserToken
        creator_ip_address: "292.268.2.2",
        creator_set_visibility: Visibility::Public,
        maybe_last_update_user_token: Some("<p> Honkai <p>".to_string()),
        original_download_url: Some("https://civitai.com/models/95243/mihoyo-collection-honkai-impact-3rd-or-honkai-star-rail-or-genshin-impact-or-zenless-zone-zero".to_string()),
        original_filename: Some("xiawolei-v100-000019.safetensors".to_string()),
        file_size_bytes: metadata2.file_size_bytes,
        file_checksum_sha2: metadata2.sha256_checksum.to_string(),
        public_bucket_hash: metadata2.bucket_details.clone().unwrap().object_hash.clone(),
        maybe_public_bucket_prefix: Some(metadata2.bucket_details.clone().unwrap().prefix),
        maybe_public_bucket_extension: Some(metadata2.bucket_details.clone().unwrap().suffix),
        version: 2,
        mysql_pool: &mysql_pool, // replace with actual MySqlPool
    };

    let weights3 = CreateModelWeightsArgs {
        token: &model_weight_token3, // replace with actual ModelWeightToken
        weights_type: WeightsType::StableDiffusion15, // replace with actual WeightsType
        weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
        title: "z-vae".to_string(),
        maybe_cover_image_media_file_token: None,
        maybe_description_markdown: Some(sd_vae_description.to_string()),
        maybe_description_rendered_html: Some("<p>Description</p>".to_string()),
        creator_user_token: Some(&user_token), // replace with actual UserToken
        creator_ip_address: "192.168.1.1",
        creator_set_visibility: Visibility::Public,
        maybe_last_update_user_token: Some("Last Update User Token".to_string()),
        original_download_url: Some("https://civitai.com/models/97653/z-vae".to_string()),
        original_filename: Some("zVae_v20.safetensors".to_string()),
        file_size_bytes: metadata3.file_size_bytes,
        file_checksum_sha2: metadata3.sha256_checksum.to_string(),
        public_bucket_hash: metadata3.bucket_details.clone().unwrap().object_hash,
        maybe_public_bucket_prefix: Some(metadata3.bucket_details.clone().unwrap().prefix),
        maybe_public_bucket_extension: Some(metadata3.bucket_details.clone().unwrap().suffix),
        version: 1,
        mysql_pool: &mysql_pool, // replace with actual MySqlPool
    };

    create_weight(weights1).await?;
    create_weight(weights2).await?;
    create_weight(weights3).await?;

    Ok(())
}

pub async fn seed_workflows_for_testing_inference(mysql_pool: &Pool<MySql>, user_token: UserToken) -> AnyhowResult<()>{
    let model_weight_token1 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    //let model_weight_token2 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    //let model_weight_token3 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    //let model_weight_token4 = ModelWeightToken::new_from_str("weight_n8sz47gmfw2zx02snrbz88ns9");

    let mut path_to_comfy = get_seed_tool_data_root();
    path_to_comfy.push("models/workflows/comfyui/yae_video_prod.json");
    let remote_cloud_file_client = RemoteCloudFileClient::get_remote_cloud_file_client().await?;
    let comfy_weights_descriptor = Box::new(WeightsWorkflowDescriptor {});
    let metadata1 = remote_cloud_file_client.upload_file(comfy_weights_descriptor, path_to_comfy.as_path().to_str().unwrap()).await?;

    // let mut path_to_comfy2 = get_seed_tool_data_root();
    // path_to_comfy2.push("models/workflows/comfyui/majicmixRealistic_v7.safetensors");
    // let comfy_weights_descriptor2 = Box::new(WeightsSD15Descriptor {});
    // let metadata2 = remote_cloud_file_client.upload_file(comfy_weights_descriptor2, path_to_comfy2.as_path().to_str().unwrap()).await?;

    // let mut path_to_comfy3 = get_seed_tool_data_root();
    // path_to_comfy3.push("models/workflows/comfyui/yae_video_test.json");
    // let comfy_weights_descriptor3 = Box::new(WeightsWorkflowDescriptor {});
    // let metadata3 = remote_cloud_file_client.upload_file(comfy_weights_descriptor3, path_to_comfy3.as_path().to_str().unwrap()).await?;

/*    let mut path_to_comfy4 = get_seed_tool_data_root();
    path_to_comfy4.push("models/workflows/comfyui/v3_sd15_mm.ckpt");
    let comfy_weights_descriptor4 = Box::new(WeightsSD15CkptDescriptor {});
    let metadata4 = remote_cloud_file_client.upload_file(comfy_weights_descriptor4, path_to_comfy4.as_path().to_str().unwrap()).await?;*/

    let weights1 = CreateModelWeightsArgs {
        token: &model_weight_token1, // replace with actual ModelWeightToken
        weights_type: WeightsType::ComfyUi, // replace with actual WeightsType
        weights_category: WeightsCategory::WorkflowConfig, // replace with actual WeightsCategory
        title: "yae-video-prod".to_string(),
        maybe_cover_image_media_file_token: None,
        maybe_description_markdown: Some("ComfyUI Workflow".to_string()),
        maybe_description_rendered_html: Some("<p>Description</p>".to_string()),
        creator_user_token: Some(&user_token), // replace with actual UserToken
        creator_ip_address: "192.168.1.1",
        creator_set_visibility: Visibility::Public,
        maybe_last_update_user_token: Some("Last Update User Token".to_string()),
        original_download_url: Some("https://github.com/comfyanonymous/ComfyUI".to_string()),
        original_filename: Some("yae_video_prod.json".to_string()),
        file_size_bytes: metadata1.file_size_bytes,
        file_checksum_sha2: metadata1.sha256_checksum.to_string(),
        public_bucket_hash: metadata1.bucket_details.clone().unwrap().object_hash,
        maybe_public_bucket_prefix: Some(metadata1.bucket_details.clone().unwrap().prefix),
        maybe_public_bucket_extension: Some(metadata1.bucket_details.clone().unwrap().suffix),
        version: 1,
        mysql_pool: &mysql_pool, // replace with actual MySqlPool
    };
    // let weights2 = CreateModelWeightsArgs {
    //     token: &model_weight_token2, // replace with actual ModelWeightToken
    //     weights_type: WeightsType::ComfyUi, // replace with actual WeightsType
    //     weights_category: WeightsCategory::WorkflowConfig, // replace with actual WeightsCategory
    //     title: "v1-5-pruned-emaonly".to_string(),
    //     maybe_description_markdown: Some("Test model for ComfyUI".to_string()),
    //     maybe_description_rendered_html: Some("<p>Description</p>".to_string()),
    //     creator_user_token: Some(&user_token), // replace with actual UserToken
    //     creator_ip_address: "192.168.1.1",
    //     creator_set_visibility: Visibility::Public,
    //     maybe_last_update_user_token: Some("Last Update User Token".to_string()),
    //     original_download_url: Some("https://huggingface.co/runwayml/stable-diffusion-v1-5".to_string()),
    //     original_filename: Some("v1-5-pruned-emaonly.ckpt".to_string()),
    //     file_size_bytes: metadata2.file_size_bytes as i32,
    //     file_checksum_sha2: metadata2.sha256_checksum.to_string(),
    //     public_bucket_hash: metadata2.bucket_details.clone().unwrap().object_hash,
    //     maybe_public_bucket_prefix: Some(metadata2.bucket_details.clone().unwrap().prefix),
    //     maybe_public_bucket_extension: Some(metadata2.bucket_details.clone().unwrap().suffix),
    //     version: 1,
    //     mysql_pool: &mysql_pool, // replace with actual MySqlPool
    // };

    // let weights3 = CreateModelWeightsArgs {
    //     token: &model_weight_token3, // replace with actual ModelWeightToken
    //     weights_type: WeightsType::ComfyUi, // replace with actual WeightsType
    //     weights_category: WeightsCategory::WorkflowConfig, // replace with actual WeightsCategory
    //     title: "yae-video-test".to_string(),
    //     maybe_description_markdown: Some("Test workflow for ComfyUI".to_string()),
    //     maybe_description_rendered_html: Some("<p>Description</p>".to_string()),
    //     creator_user_token: Some(&user_token), // replace with actual UserToken
    //     creator_ip_address: "192.168.1.1",
    //     creator_set_visibility: Visibility::Public,
    //     maybe_last_update_user_token: Some("Last Update User Token".to_string()),
    //     original_download_url: Some("https://github.com/comfyanonymous/ComfyUI".to_string()),
    //     original_filename: Some("yae-video-test.json".to_string()),
    //     file_size_bytes: metadata3.file_size_bytes as i32,
    //     file_checksum_sha2: metadata3.sha256_checksum.to_string(),
    //     public_bucket_hash: metadata3.bucket_details.clone().unwrap().object_hash,
    //     maybe_public_bucket_prefix: Some(metadata3.bucket_details.clone().unwrap().prefix),
    //     maybe_public_bucket_extension: Some(metadata3.bucket_details.clone().unwrap().suffix),
    //     version: 1,
    //     mysql_pool: &mysql_pool, // replace with actual MySqlPool
    // };

    // let weights4 = CreateModelWeightsArgs {
    //     token: &model_weight_token4, // replace with actual ModelWeightToken
    //     weights_type: WeightsType::ComfyUi, // replace with actual WeightsType
    //     weights_category: WeightsCategory::WorkflowConfig, // replace with actual WeightsCategory
    //     title: "v3_sd15_mm".to_string(),
    //     maybe_description_markdown: Some("ComfyUI motion module".to_string()),
    //     maybe_description_rendered_html: Some("<p>Description</p>".to_string()),
    //     creator_user_token: Some(&user_token), // replace with actual UserToken
    //     creator_ip_address: "192.168.1.1",
    //     creator_set_visibility: Visibility::Public,
    //     maybe_last_update_user_token: Some("Last Update User Token".to_string()),
    //     original_download_url: Some("https://huggingface.co/guoyww/animatediff/blob/main/v3_sd15_mm.ckpt".to_string()),
    //     original_filename: Some("v3_sd15_mm.ckpt".to_string()),
    //     file_size_bytes: metadata4.file_size_bytes as i32,
    //     file_checksum_sha2: metadata4.sha256_checksum.to_string(),
    //     public_bucket_hash: metadata4.bucket_details.clone().unwrap().object_hash,
    //     maybe_public_bucket_prefix: Some(metadata4.bucket_details.clone().unwrap().prefix),
    //     maybe_public_bucket_extension: Some(metadata4.bucket_details.clone().unwrap().suffix),
    //     version: 1,
    //     mysql_pool: &mysql_pool, // replace with actual MySqlPool
    // };

    create_weight(weights1).await?;
    // create_weight(weights2).await?;
    // create_weight(weights3).await?;
    // create_weight(weights4).await?;

    Ok(())
}

pub async fn seed_weights_for_user_token(
    mysql_pool: &Pool<MySql>,
    user_token: UserToken
) -> AnyhowResult<()> {
    info!("Seeding weights...");

    ModelWeightToken::reset_rng_for_testing_and_dev_seeding_never_use_in_production_seriously(54321);

    let model_weight_token1 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let model_weight_token2 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let model_weight_token3 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let model_weight_token4 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let model_weight_token5 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();

    let model_weights_args = vec![
        CreateModelWeightsArgs {
            token: &model_weight_token1, // replace with actual ModelWeightToken
            weights_type: WeightsType::RvcV2, // replace with actual WeightsType
            weights_category: WeightsCategory::VoiceConversion, // replace with actual WeightsCategory
            title: "Title 1".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 1".to_string()),
            maybe_description_rendered_html: Some("<p>Description 1</p>".to_string()),
            creator_user_token: Some(&user_token), // replace with actual UserToken
            creator_ip_address: "192.168.1.1",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 1".to_string()),
            original_download_url: Some("http://example.com/download1".to_string()),
            original_filename: Some("filename1.txt".to_string()),
            file_size_bytes: 1024,
            file_checksum_sha2: "checksum1".to_string(),
            public_bucket_hash: "bucket_hash1".to_string(),
            maybe_public_bucket_prefix: Some("rvc_".to_string()),
            maybe_public_bucket_extension: Some(".pt".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 1,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token2, // replace with actual ModelWeightToken
            weights_type: WeightsType::HifiganTacotron2, // replace with actual WeightsType
            weights_category: WeightsCategory::TextToSpeech, // replace with actual WeightsCategory
            title: "Title 2".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 2".to_string()),
            maybe_description_rendered_html: Some("<p>Description 2</p>".to_string()),
            creator_user_token: Some(&user_token), // replace with actual UserToken
            creator_ip_address: "292.268.2.2",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 2".to_string()),
            original_download_url: Some("http://example.com/download2".to_string()),
            original_filename: Some("filename2.txt".to_string()),
            file_size_bytes: 2024,
            file_checksum_sha2: "checksum2".to_string(),
            public_bucket_hash: "bucket_hash2".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("tt2".to_string()),
            //cached_user_ratings_total_count: 20,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 2,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 2,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token3, // replace with actual ModelWeightToken
            weights_type: WeightsType::StableDiffusion15, // replace with actual WeightsType
            weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
            title: "Title 3".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 3".to_string()),
            maybe_description_rendered_html: Some("<p>Description 3</p>".to_string()),
            creator_user_token: Some(&user_token), // replace with actual UserToken
            creator_ip_address: "392.368.3.3",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 3".to_string()),
            original_download_url: Some("http://example.com/download3".to_string()),
            original_filename: Some("filename3.txt".to_string()),
            file_size_bytes: 3024,
            file_checksum_sha2: "checksum3".to_string(),
            public_bucket_hash: "bucket_hash3".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("safetensors".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 1,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token4, // replace with actual ModelWeightToken
            weights_type: WeightsType::LoRA, // replace with actual WeightsType
            weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
            title: "Title 4".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 4".to_string()),
            maybe_description_rendered_html: Some("<p>Description 4</p>".to_string()),
            creator_user_token: Some(&user_token), // replace with actual UserToken
            creator_ip_address: "192.168.1.1",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 4".to_string()),
            original_download_url: Some("http://example.com/download1".to_string()),
            original_filename: Some("filename1.txt".to_string()),
            file_size_bytes: 1024,
            file_checksum_sha2: "checksum4".to_string(),
            public_bucket_hash: "bucket_hash4".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("LoRA".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 2,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token5, // replace with actual ModelWeightToken
            weights_type: WeightsType::LoRA, // replace with actual WeightsType
            weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
            title: "Title 5".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 4".to_string()),
            maybe_description_rendered_html: Some("<p>Description 4</p>".to_string()),
            creator_user_token: Some(&user_token), // replace with actual UserToken
            creator_ip_address: "192.168.1.1",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 4".to_string()),
            original_download_url: Some("http://example.com/download1".to_string()),
            original_filename: Some("filename1.txt".to_string()),
            file_size_bytes: 1024,
            file_checksum_sha2: "checksum4".to_string(),
            public_bucket_hash: "bucket_hash4".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("LoRA".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 2,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        }
    ];

    for model_weights_arg in model_weights_args {
        create_weight(model_weights_arg).await?;
    }
    Ok(())
}


pub async fn original_seed_weights(mysql_pool: &Pool<MySql>, _user_token: UserToken) -> AnyhowResult<()> {
    let model_weight_token1 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let creator_token1 = UserToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();

    let model_weight_token2 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let creator_token2 = UserToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();

    let model_weight_token3 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let creator_token3 = UserToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();

    let model_weight_token4 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let creator_token4 = UserToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();

    let model_weight_token5 = ModelWeightToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();
    let creator_token5 = UserToken::generate_for_testing_and_dev_seeding_never_use_in_production_seriously();

    let model_weights_args = vec![
        CreateModelWeightsArgs {
            token: &model_weight_token1, // replace with actual ModelWeightToken
            weights_type: WeightsType::RvcV2, // replace with actual WeightsType
            weights_category: WeightsCategory::VoiceConversion, // replace with actual WeightsCategory
            title: "Title 1".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 1".to_string()),
            maybe_description_rendered_html: Some("<p>Description 1</p>".to_string()),
            creator_user_token: Some(&creator_token1), // replace with actual UserToken
            creator_ip_address: "192.168.1.1",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 1".to_string()),
            original_download_url: Some("http://example.com/download1".to_string()),
            original_filename: Some("filename1.txt".to_string()),
            file_size_bytes: 1024,
            file_checksum_sha2: "checksum1".to_string(),
            public_bucket_hash: "bucket_hash1".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("rvc".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 1,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token2, // replace with actual ModelWeightToken
            weights_type: WeightsType::HifiganTacotron2, // replace with actual WeightsType
            weights_category: WeightsCategory::TextToSpeech, // replace with actual WeightsCategory
            title: "Title 2".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 2".to_string()),
            maybe_description_rendered_html: Some("<p>Description 2</p>".to_string()),
            creator_user_token: Some(&creator_token2), // replace with actual UserToken
            creator_ip_address: "292.268.2.2",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 2".to_string()),
            original_download_url: Some("http://example.com/download2".to_string()),
            original_filename: Some("filename2.txt".to_string()),
            file_size_bytes: 2024,
            file_checksum_sha2: "checksum2".to_string(),
            public_bucket_hash: "bucket_hash2".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("tt2".to_string()),
            //cached_user_ratings_total_count: 20,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 2,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 2,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token3, // replace with actual ModelWeightToken
            weights_type: WeightsType::StableDiffusion15, // replace with actual WeightsType
            weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
            title: "Title 3".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 3".to_string()),
            maybe_description_rendered_html: Some("<p>Description 3</p>".to_string()),
            creator_user_token: Some(&creator_token3), // replace with actual UserToken
            creator_ip_address: "392.368.3.3",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 3".to_string()),
            original_download_url: Some("http://example.com/download3".to_string()),
            original_filename: Some("filename3.txt".to_string()),
            file_size_bytes: 3024,
            file_checksum_sha2: "checksum3".to_string(),
            public_bucket_hash: "bucket_hash3".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("safetensors".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 1,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token4, // replace with actual ModelWeightToken
            weights_type: WeightsType::LoRA, // replace with actual WeightsType
            weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
            title: "Title 4".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 4".to_string()),
            maybe_description_rendered_html: Some("<p>Description 4</p>".to_string()),
            creator_user_token: Some(&creator_token4), // replace with actual UserToken
            creator_ip_address: "192.168.1.1",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 4".to_string()),
            original_download_url: Some("http://example.com/download1".to_string()),
            original_filename: Some("filename1.txt".to_string()),
            file_size_bytes: 1024,
            file_checksum_sha2: "checksum4".to_string(),
            public_bucket_hash: "bucket_hash4".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("LoRA".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 2,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        },
        CreateModelWeightsArgs {
            token: &model_weight_token5, // replace with actual ModelWeightToken
            weights_type: WeightsType::LoRA, // replace with actual WeightsType
            weights_category: WeightsCategory::ImageGeneration, // replace with actual WeightsCategory
            title: "Title 5".to_string(),
            maybe_cover_image_media_file_token: None,
            maybe_description_markdown: Some("Description 5".to_string()),
            maybe_description_rendered_html: Some("<p>Description 5</p>".to_string()),
            creator_user_token: Some(&creator_token5), // replace with actual UserToken
            creator_ip_address: "192.168.1.1",
            creator_set_visibility: Visibility::Public,
            maybe_last_update_user_token: Some("Last Update User Token 5".to_string()),
            original_download_url: Some("http://example.com/download1".to_string()),
            original_filename: Some("filename1.txt".to_string()),
            file_size_bytes: 1025,
            file_checksum_sha2: "checksum5".to_string(),
            public_bucket_hash: "bucket_hash5".to_string(),
            maybe_public_bucket_prefix: Some("_fake".to_string()),
            maybe_public_bucket_extension: Some("LoRA".to_string()),
            //cached_user_ratings_total_count: 10,
            //cached_user_ratings_positive_count: 9,
            //cached_user_ratings_negative_count: 1,
            //maybe_cached_user_ratings_ratio: Some(0.9),
            version: 2,
            mysql_pool: &mysql_pool, // replace with actual MySqlPool
        }
    ];

    for model_weights_arg in model_weights_args {
        create_weight(model_weights_arg).await?;
    }

    Ok(())

}

pub async fn seed_weights(mysql_pool: &Pool<MySql>) -> AnyhowResult<()> {
    info!("Seeding weights...");
    
    let user_token = match get_user_token_by_username(HANASHI_USERNAME, mysql_pool).await? {
        None => {
            return Err(anyhow!("could not find user hanashi"));
        }
        Some(token) => token,
    };

    // original_seed_weights(mysql_pool,user_token).await?;
    seed_weights_for_user_token(mysql_pool, user_token).await?;
    // seed_weights_for_paging(mysql_pool,user_token).await?;
    //seed_weights_for_testing_inference(mysql_pool,user_token.clone()).await?;
    // println!("TESTING DOWLOAD");
    //test_seed_weights_files().await?;
    // seed_workflows_for_testing_inference(mysql_pool,user_token.clone()).await?;
    Ok(())
}
