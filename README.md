WebGL Forward+ and Clustered Deferred Shading
======================

* **University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5*
  
  * Ling Xie
    * [LinkedIn](https://www.linkedin.com/in/ling-xie-94b939182/), 
    * [personal website](https://jack12xl.netlify.app).
  * Tested on: 
    * Windows 10, Intel(R) Xeon(R) CPU E5-2650 v4 @ 2.20GHz 2.20GHz ( two processors) 
    * 64.0 GB memory
    * NVIDIA TITAN XP GP102
  
  Thanks to [FLARE LAB](http://faculty.sist.shanghaitech.edu.cn/faculty/liuxp/flare/index.html) for this ferocious monster.

### Live Online

[![](img/thumb.png)](http://TODO.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred)

### Demo Video/GIF

[![](img/video.png)](TODO)

### (TODO: Your README)



#### Light Culling

From [this](http://www.aortiz.me/2018/12/21/CG.html#tiled-shading--forward):

```c++
//Light culling
for cluster in clusterArray
   for light in scene
      if lightIncluster(cluster, light)
          cluster += light
```



### Reference:

- Forward-Plus-Renderer



### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
