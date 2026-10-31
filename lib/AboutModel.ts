import { Schema, deleteModel, model, models } from "mongoose";

// The About page's text, editable by admins. There's only ever one of these.
const AboutSchema = new Schema({ title: String, body: String }, { timestamps: true });

if (process.env.NODE_ENV !== "production" && models.About) deleteModel("About"); // see PostModel.ts
const About = models.About || model("About", AboutSchema);

export default About;
