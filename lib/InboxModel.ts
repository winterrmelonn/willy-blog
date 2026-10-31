import { Schema, deleteModel, model, models } from "mongoose";

// What signed-in visitors send Willy from their profile: a message, or a blog they'd like posted.
const InboxSchema = new Schema(
    {
        kind: { type: String, enum: ["message", "blog"], required: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        title: String, // blog requests only
        content: { type: [String], required: true },
    },
    { timestamps: true },
);

if (process.env.NODE_ENV !== "production" && models.Inbox) deleteModel("Inbox"); // see PostModel.ts
const Inbox = models.Inbox || model("Inbox", InboxSchema);

export default Inbox;
