import { Schema, deleteModel, model, models } from "mongoose";

// An admin's edits to a project on /projects. `key` matches one of the projects listed in app/projects/page.tsx.
const ProjectSchema = new Schema(
    {
        key: { type: String, required: true, unique: true },
        name: String,
        when: String,
        about: String,
        links: [{ label: String, href: String, _id: false }],
        image: String, // id of the cover image (lib/ImageModel.ts), if it has one
    },
    { timestamps: true },
);

if (process.env.NODE_ENV !== "production" && models.Project) deleteModel("Project"); // see PostModel.ts
const Project = models.Project || model("Project", ProjectSchema);

export default Project;
