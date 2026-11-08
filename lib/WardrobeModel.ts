import { Schema, deleteModel, model, models } from "mongoose";

// Clothes in Willy's wardrobe (/wardrobe, admins only). `seq` counts up as items are added and gives each
// its code, e.g. RI-TOP-0007; codes never change, and a deleted item's number isn't reused.
export const CATEGORIES = ["TOP", "BTM", "OUT", "FTW", "ACC"] as const;

const WardrobeItemSchema = new Schema(
    {
        seq: { type: Number, required: true, unique: true },
        name: { type: String, required: true },
        cat: { type: String, enum: CATEGORIES, required: true },
        brand: String,
        size: String,
        color: String, // #rrggbb
        value: Number, // dollars
        notes: String,
    },
    { timestamps: true },
);

if (process.env.NODE_ENV !== "production" && models.WardrobeItem) deleteModel("WardrobeItem"); // see PostModel.ts
const WardrobeItem = models.WardrobeItem || model("WardrobeItem", WardrobeItemSchema);

export default WardrobeItem;
