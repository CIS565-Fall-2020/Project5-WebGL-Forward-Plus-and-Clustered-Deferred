WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Han Yan
* Tested on: Macbook Pro

### Live Online

![](img/p1.png)[https://tracy-yan.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred/]

### Demo Video/GIF

![](img/proj5.gif)

## Performance Analysis

### Forward+ vs. Clustered Deferred

For my implementation, clustered deferred is faster when the number of lights per cluster is large. For other cases where the number of clusters is larger than total number of lights, Forward+ performs better. So I think the most significant factor is the number of lights per cluster.

With 15x15x15 clusters and 100 lights, rate for Forward+ is 15.5 fps and rate for clustered deferred is 14.8 fps. With 2x2x2 clusters and 300 lights, rate for Forward+ is 32 fps and rate for clustered deferred is 44 fps. 

The advantage of Forward+ is that it has one less stage in the pipeline, but it does expensive lighting computation on every fragment. The advantage of clustered deferred is that it does the lighting computation on fewer fragments, but it uses more memory for passign gbuffer data and slows down rendering with one more stage in pipeline.

### Blinn-Phong Shading

Blinn-Phong shading provides better visual effect. It does not affect performance since it only adds a few more lines of mathematics computation.

### G-Buffer Optimization

Before optimization, I use 4 Gbuffers, to pass vertex positions, normals, colors and view projected positions. But since view projected positions can be computed in the next fragment shader, it suffices to use 3 Gbuffers.

* 4 GBuffers: 62 ms; 3 GBuffers: 71 ms.

This optimization is not dependent on the scenarios. There's no significant tradeoff, as having less buffer data always reduce memory usage and blocking time. 

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
