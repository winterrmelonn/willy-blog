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