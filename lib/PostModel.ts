import { Schema, deleteModel, model, models } from "mongoose";

const PostSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
        },
        id: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        content: {
            type: [String],
            required: true,
        },
    },
    { timestamps: true },
);

// In dev, hot reload keeps the previous version of the model in memory, so schema changes (like
// content becoming a list) wouldn't apply until a restart. Drop the old one and rebuild it.
if (process.env.NODE_ENV !== "production" && models.Post) deleteModel("Post");
const Post = models.Post || model("Post", PostSchema);

export default Post;