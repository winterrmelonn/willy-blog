Added a mesh using planeGeometry and chose a nice dark green color for the background and plane. Added fog as well that matched the color of the background but not the new plane. Rotated the plane 90 degrees toward me because planeGeometry spawn in straight up for some reason. Adjusted camera position, lily scale and lily position to make sense with the plane.

Used an array and a .map to generate random positions using Math.random for the x and z postions of the lillies for the field. Got 30 lillies to spawn out in the field. Claude advised to switch to instancing to fill in the entire field, because 1000 lillies all manually generated would start lagging the website. Learned what instancing is; the GPU renders the shape and look once, and then makes a bunch of copies at each position at once.

Ran into an infinite recusion error because LilyField was drawing itself, didn't know what to do because TSX marked it as valid, and had to use Claude to troubleshoot that.

Okay to implement instancing first used destructuring via const { nodes } to pull out the mesh and the texture. Ran into trouble figuring out what the name of the mesh was exactly, since I downloaded the model. I had to run a console.log troubleshoot and access localhost:3000 on Chrome instead of the VS Code simple browser to read the console, and finally found the specific mesh name which was: "LycorisRadiata_LycorisRadiataTexture_0". Like bruh. Used Instances tag to render the geometry and the material and then a .map to generate positions for all of the instances.

NOTE: I'm adding to the devlog AS I make the changes, and a lot of these notes are hours if not days apart.
Made some fixes with the array. I was rendering 7000 lillies, but they were spread from -12 to 12 in the x, a lot of which the camera couldn't see. I shrunk down that range to about -7 to 7, which helped make the field a lot denser. 

Next, I added a breeze. Did this by asking Claude, first of all, then adding a shader writed in GLSL. Too many languages in this project, and I'm learning each slowly (and reading a LOT of docs). For the wind function you use a sin wave and the instance matrix to map the "wind" (just a transformation that pushes the points of the lillies sideways) onto the position of the lillies. Did the same for the grass.

Switched from ambientLight to hemisphereLight, which basically only made it lighter, not too crazy of a change. Ran into some issues with useMemo and useFrame, and learned "use" blocks MUST be in the component body (I accidentally used useFrame inside of useMemo.)

Made some color changes to the lighting, background, fog, and grass colors.
Changed the grass from ugly 3 faced triangles to nicer, tapered blades that better resemble grass using PlaneGeometry, similar to the manual spider lily stem I was working on in the previous dev log (which you can also see in the noted out portions of my code.)

FINALLY started to move away from this 3D stuff and back to the website stuff. Started by moving the "my blogs" button to the side of "willy.work" using flex. (learned I needed items-center as well)

Finally fixed the buttoms having a green background. (simple fix, just added bg-white/70 dark:bg-black/50 backdrop-blur to the div className)

Working on making the blog part of the website actually functional. Quick fix: changed "content" in PostModel.ts from String to [String] so that the blog can be a list of strings and not just one. Made a quick security fix by making the function that posts the blog verify authenthication.

Pushed everything done up til now.