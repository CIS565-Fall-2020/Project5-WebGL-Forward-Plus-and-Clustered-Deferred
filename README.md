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

##### intro to light culling

Since most of our time contributes to this, so here we would like to introduce the following in detail:

##### The way we implement

We choose to uniformly divide the frustum from NDC plane, then map the divided grid back to world space as frustum. The pipeline for assigning each light to its frustum would be

```bash
NDC (x, y, z ranged from [-1,1] ) space
to
clip space (x, y, z, w)
to 
view space
to 
world space
```

In this way it could largely **reduce** the calculation in fragment shader. Because here we only need to calculate fragment position according to the NDC space. Compared to **directly dividing the frustum in world or view space,** here we could save memory and computation like

- buffer for `whole frustum position(include near, far, vertices' position) `in view or world space, 
- deciding the frustum for the frag_coordinate is nontrivial, while the grid in NDC space is mush easier.

which could both save time for shader memory and computation. (Due to time constrain, we did not implement and compare each method).

However, this method still introduce some sort of headaches and drawbacks:

- The most technically challenging key point is how to recover the **W** component of NDC space since the  **W** component is lost.
- Mapping `NDC Z component` to view space is **non-linear**. To make the frustum uniform in Z-side, we need to explicitly design the way we split the NDC Z component. 
  - Here we directly make the Z slice to one, literally only slicing the X, Y component. 
- Last but not least, the **three.js** API is not that handy and prone to bugs. Also, switching `three.Vector ` between  `native javascript array` ,`glsl.vec` is not straight and disappointingly tedious.



To demonstrate the frustum assigning is implemented right, here we show

show all I got

### Reference:

- Forward-Plus-Renderer



### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
* Map NDC to clip space
* 
