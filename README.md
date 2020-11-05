WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Weiyu Du
* Tested on: Mac Laptop

### Live Online

<img src="https://github.com/WeiyuDu/Project5-WebGL-Forward-Plus-and-Clustered-Deferred/blob/master/img/proj5_capture.png" width=600/>

### Demo Video

Demo Video Link: https://youtu.be/3YsZx6-DenI

### Description

#### Forward+
#### Clustered Deferred
#### Blinn-Phong Shading
#### g-buffer optimization with 2-component normals

### Performance Analysis
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

3) g-buffer optimization with 2-component normals

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
