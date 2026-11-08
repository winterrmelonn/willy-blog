import type { PostType } from "@/app/post/actions";
import { redirect } from "next/navigation";
import Post from "@/lib/PostModel";
import dbConnect from "@/lib/mongoose";
import Cover from "@/components/Cover";

async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();
  const post = (await Post.findOne({ id: id })) as PostType;
  if (!post) redirect("/");

  return (
    <main className="w-full max-w-2xl mx-auto px-4 pb-10">
      <Cover
        big
        image={post.image}
        className="mt-10 mb-6"
        title={post.title}
        sub={post.date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      />
      {/* keep the line breaks and spaces as typed (HTML squashes them into one space otherwise) */}
      <div className="flex flex-col gap-4 whitespace-pre-wrap leading-relaxed">
        {post.content.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </main>
  );
}

export default Page;
