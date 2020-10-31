WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**

* Li Zheng
  * [LinkedIn](https://www.linkedin.com/in/li-zheng-1955ba169)
* Tested on: Windows CUDA10, i5-3600 @ 3.59GHz 16GB, RTX 2060 6GB (personal computer)

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred)

### Demo Video/GIF

[![](img/video.png)](TODO)

### Performance & Analysis
#### Compare Forward+ and Clustered Deferred shading
Forward+ is faster if there are few lights and culled fragments. Otherwise, Clustered Deferred shading is faster. Farward+ shades all fragments. Clustered Deferred only shade fragments passing depth test. So the scene with large number of lights and culled fragments should have a better performance using Clustered Deferred shading. But Clustered Deferred takes more passes of texture to store geometries, witch result in relatively bad performance with few lights. Also, Clustered Deferred shading has limitations of material flexibility, no translucency and MSAA requires high memory usage. 

#### New Effect Features
I analyze the performance of shading with varying number of lights and tile size. For the Clustered Deferred shading, I implement a post processing of Toon shading.  
![](img/numOfLights.PNG)  
The figure show the time (ms) per frame of three different shading methods with increasing number of lights. Cluster Deferred Shading has the best performance. Forward+ comes next.
The time of original Forward Shading increases proportionally with number of lights.

![](img/tileSize.PNG.PNG)   
![](img/toonShader.PNG)  

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
