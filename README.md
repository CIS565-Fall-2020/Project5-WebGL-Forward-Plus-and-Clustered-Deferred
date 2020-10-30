WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Jilin Liu
  * [LinkedIn](https://www.linkedin.com/in/jilin-liu-61b273192/), [twitter](https://twitter.com/Jilin18043110).
* Tested on: Windows 10, i7-8750H @ 2.20GHz, 16GB, GTX 1050Ti 4096MB (personal)

**This repo contains a WebGL implementation of a basic Forward Plus Rendering and Clustered Deferred Rendering.**

## Live Online
https://youtu.be/xHVpaft3udE

## Demo Video/GIF

[YouTube](https://youtu.be/xHVpaft3udE)

## Features
1. Forward+ Rendering
2. Clustered Deferred Rendering

### Forward+ Rendering
We split the camera frustum into sub-frustums to act as light clusters. Each cluster will record the lights which may have potential contribution to objects in that cluster. Then in the shader, we can determine the cluster that a given point belongs to and then unpack lights from that cluster to avoid iterating the whole bunch of lights in the scene.

![](./img/forward+.png)

### Clustered Deferred Rendering
We can defer the shading stage by first storing the scene information to g-buffer and then use it later in the pixel shader to avoid per-fragment calculations. Again, we can use light clusters to reduce the cost of evaluating lights.

![](./img/screenshot.png)

The number of lights now has different influences on these three rendering methods.

| Number of Lights | 60 | 125 | 250 |
|---|---|---|---|
| Forward | 53ms | 100ms | 213ms |
| Forward+ | 60ms | 154ms | 318ms |
| Clustered Deferred | 26ms | 67ms | 113ms |

### Blinn-Phong Shading
Blinn-Phong shading is calculated in camera space so we don't need extra information to feed to the shader. It adds more highlight to the surface.

![](./img/compareBlinn.png)

### G-buffer Optimization
I packed the normal into two float numbers and utilized the alpha value of a vec4, which produces a g-buffer with two vec4 compared with a naive implementation's three vec4. As you can see below, this simple optimization has reduced the execution time for each frace a little bit.

| Timing in milliseconds for each frame | --- |
|---|---|
| 3 vec4 | 26ms |
| 2 vec4 (optimized g-buffer) | 24ms |

## Limitations
The number of clusters is now hard-coded. As a result, it may require knowledge about the radius of lights to make it more efficient. No frustum-sphere intersection checking is used here, and this should be further optimized to better suit scenes with large radius lights and small clusters.

Also, as a naive estimation, no shadow map is used here so it might be inaccurate for scenes with many tiny objects blocking the light source.

## Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
