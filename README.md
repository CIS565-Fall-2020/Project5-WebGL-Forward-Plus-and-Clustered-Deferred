WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* (TODO) YOUR NAME HERE
* Tested on: (TODO) **Google Chrome 222.2** on
  Windows 22, i7-2222 @ 2.22GHz 22GB, GTX 222 222MB (Moore 2222 Lab)

### Live Online

[![](img/thumb.png)](http://j9liu.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred)

### Demo Video/GIF

[![](img/video.png)](TODO)

## Performance Analysis Methods

had to use debug window because otherwise this was too fast to substantially analyze

## Forward+

### Per-Frustum Iteration (Naive)

### Per-Light Iteration (Optimized)

## Clustered Deferred

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)

**Math References**

* [Plane equations](http://www.songho.ca/math/plane/plane.html?fbclid=IwAR0qZN0UzxIcByyhQivKEInBdeMxfxHjyu_jUPumApHeQe9-R2-IPrc_Y04) by Song Ho Ahn
* [Frustum and sphere intersection](https://www.flipcode.com/archives/Frustum_Culling.shtml) by Dion Picco
* [Help with screen to world transformations](https://gamedev.stackexchange.com/questions/56725/calculate-object-coordinates-from-window-coordinates-using-inverse-projection-ma) by Daniel Flassig
