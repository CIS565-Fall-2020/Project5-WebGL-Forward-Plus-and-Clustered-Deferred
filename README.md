WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Weiyu Du
* Tested on: Mac Laptop

### Live Online

https://weiyudu.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred/

<img src="https://github.com/WeiyuDu/Project5-WebGL-Forward-Plus-and-Clustered-Deferred/blob/master/img/proj5_capture.png" width=600/>

### Demo Video

Demo Video Link: https://youtu.be/3YsZx6-DenI

### Description
Features implemented:
- Forward+
- Clustered Deferred
- Blinn-Phong Shading
- g-buffer optimization with 2-component normals

### Performance Analysis
(Apologies, I misread the instruction earlier and thought we ought to use fps instead of ms.)

1) Please see below for FPS versus Number of Lights for the three methods with **max number of lights per cluster = 100**.

| Number of Lights | Forward | Forward+ | Clustered Deferred|
| --- | --- | --- | --- |
| 100 | 14        |  9          | 16|
| 200 | 7        |  9          | 16|
| 500 | 3        |  9          | 16|
| 1000 | 1        |  9          | 16|

When number of lights is relatively large, Forward+ is faster than Forward, while Clustered Deferred is faster than Forward+. We see there's no obvious decrease in FPS when number of lights increases for Forward+ and Clustered Deferred.

2) Please see below for FPS versus Number of Lights for the three methods with **max number of lights per cluster = number of lights**.

| Number of Lights | Forward | Forward+ | Clustered Deferred|
| --- | --- | --- | --- |
| 100 | 14        |  9          | 16|
| 150 | 9        |  6          | 12|
| 200 | 7        |  5          | 9|
| 250 | 6        |  4          | 7|

In this case, Forward+ is slightly worse than Forward, while Clustered Deferred is slightly better than Forward.

3) g-buffer optimization with 2-component normals on Clustered Deferred, **max number of lights per cluster = number of lights**.

| Number of Lights | without optimization | with optimization |
| --- | --- | --- |
| 100 | 16        |    21        |
| 150 | 12        |  15          |
| 200 | 9       |  12          |
| 250 | 7        |  10          |

Instead of using another vector for normal, we first normalize it, then squeeze the x and y component of the normal vector in vec4 for color and position (which are both vec3). Finally we compute the z component with sqrt(1 - x * x - y * y). Since we're saving the amount of memory we're passing around, we observe obvious improvement in terms of FPS with 2-component normals.

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
