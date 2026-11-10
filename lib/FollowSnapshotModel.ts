import { Schema, deleteModel, model, models } from "mongoose";

// The follower list from the last Instagram export loaded on /followback (admins only), so the next one can
// show who unfollowed. A single document, replaced on every load.
const FollowSnapshotSchema = new Schema({ followers: { type: [String], required: true } }, { timestamps: true });

if (process.env.NODE_ENV !== "production" && models.FollowSnapshot) deleteModel("FollowSnapshot"); // see PostModel.ts
const FollowSnapshot = models.FollowSnapshot || model("FollowSnapshot", FollowSnapshotSchema);

export default FollowSnapshot;
