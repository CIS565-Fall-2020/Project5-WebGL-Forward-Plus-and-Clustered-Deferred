WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**
* Thy (Tea) Tran 
  * [LinkedIn](https://www.linkedin.com/in/thy-tran-97a30b148/), [personal website](https://tatran5.github.io/), [email](thytran316@outlook.com)
* Tested on: Google Chrome, Version 86.0.4240.183 (Official Build) (64-bit) on Windows 10, i7-8750H @ 2.20GHz 22GB, GTX 1070

### Live Online

[![](img/thumb.png)](http://tatran5.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred)

### Demo Video/GIF

![](img/allRenders.gif)

### Features

**Forward plus**
* I tried implementing this parts in 3 different ways.
    - The first way is to iterate through all the x, y and z indices of the z-buffer, then have an inner loop to iterate through all the lights to check whether it intersects with this cluster. Constructing the cluster frustum takes time due to the construction of 6 planes making the frustum, and iterating through all lights is problematic when there are large number of lights in a scene.
    - The second and third ways are similar to each other. I iterate through all the lights, and for each light, i find the bounding box for the light and find the minimum and maximum x, y, and z indices of the cluster that the light overlaps. Then, iterate through those clusters and update them to include this light to have influence on the geometry within the cluster. However, the difference is that one method calculates the view and width of the frustum slice where the bounding coordinates lie on to find the min and max cluster indicies (x and y), while the other gets the cluster indices from transforming the bounding cordinates to screen space. The former method requires less matrix math and fewer calculations, which makes it faster than the latter method.

* For the shader, to test my calculation for the cluster index per fragment, I output the calculated cluster index in each x, y, z direction.

|Cluster shader x | Cluster shader y | Cluster shader z |
|---|---|---|
|![](img/cluster_shader_x.png =200x)|![](img/cluster_shader_y.png =200x)|![](img/cluster_shader_z.png =200x)|


**Clustered deferred shading**
* Reuse clustering logic from  with optimizations
* Store vertex attributes in g-buffers (position, albedo color and normal)
* Read g-buffer in a shader to produce final output

To make sure that I was inputting and getting the right data from the g-buffers, I output the data from g-buffers to the final shader.

|Position | Color (albedo) | Normal |
|---|---|---|
|![](img/gbuffer_position.png)|![](img/gbuffer_albedo.png)|![](img/gbuffer_normal.png)|

**Blinn-Phong shading for point lights** (deferred shading)
* The effects makes the light reflection more intense at some places, while the original implementation  makes the light looking more diffuse (spreading out more uniformly)

**Optimizations for g-buffers by using 2-component normals**
* By storing 2-components of a normal, we can estimate the remaining component by 'normal.z = sqrt(1 - pow(normal.x, 2) - pow(normal.y, 2))' because the normals are normalized. However, this is clearly not perfect, since the third component can originally be positive or negative, but we can't have that exact info when re-constructing the third component. There are some details lost as a result. Another noticeable artifact is the occasional random black specs in the renders.
  
|Normals (ground truth) | Normals (z reconstructed) | 
|---|---|
|![](img/normals_groundTruth.png)|![](img/normals_recontructed.png)|

Deferred shading (ground truth) | Deferred shading (z-reconstructed)|
|---|---|
|![](img/deferred.png)|![](img/deferred_reconstructedZ.png)|
### Performance & Analysis 

![](img/renderersRuntime.png)

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
