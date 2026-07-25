// NOTE: These are defined in Rust (as the source of truth) and duplicated in the frontend.
// In the future, we should use code gen (protobufs or similar) to keep the two sides in sync.

export enum TaskType {
  ImageGeneration = "image_generation",
  ImageInpaintEdit = "image_inpaint_edit",
  VideoGeneration = "video_generation",
  ObjectGeneration = "object_generation",
  SplatGeneration = "gaussian_generation",
  BackgroundRemoval = "background_removal",
}
