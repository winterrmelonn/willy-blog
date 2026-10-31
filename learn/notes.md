JSX: 
<> These things are called tags. They need corresponding closing tags, which have a slash in them. ex: <main></main>

There are also self closing tags, which end with a /. 
ex: <img />

' can get code confused. &rsquo --> '

<a> means "link"
<p> means "paragraph"
href means "url"

tailwind:

<p className="">(add text in between here)</p>
In the quotes you can add classes.
(spacing and size numbers: 1 = 4 px)
p-4 - padding 16 px (padding is the space inside of an element)
m-8 - margin 32 px (margin is space outside the element)
gap-2 - gap 8 px

add letters for direction: x (left/right), y (top/bottom), t (top), b (bottom), l, r 
ex: mt-4 (margin, top, 16px)

colors go from 50-950 (lightest - darkest).

react three: 

Three.js geometry uses args.
For tubeGeometry, the order is:

args={[curve, tubularSegments, radius, radialSegments, closed]}

(later just read docs for this info)

git cli command notes:

git status - what's changed
git add - adding to stage (which is what gets added to the repo when you push)
git commit - saves changes to local history before pushing to github
git remote add origin <url> - link to existing github repo
git push - saves local changes to github repo
        first push looks like: git push -u origin main

flags:

-A "all"
-m "message" 
        ex: git commit -m "message here"
-u - short for --set-upstream (without it every push has to set the destination: origin main)