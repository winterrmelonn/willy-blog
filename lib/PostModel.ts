import { Schema, model, models } from "mongoose";

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

const Post = models.Post || model("Post", PostSchema);

export default Post;