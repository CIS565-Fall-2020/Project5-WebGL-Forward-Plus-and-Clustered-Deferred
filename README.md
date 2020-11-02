WebGL Forward+ and Clustered Deferred Shading
======================

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Project 5**
* Haorong Yang
* [LinkedIn](https://www.linkedin.com/in/haorong-henry-yang/)
* Tested on: Windows 10 Home, i7-10750H @ 2.60GHz 16GB, GTX 2070 Super Max-Q (Personal)

[Online Live Demo](https://yangh34.github.io/Project5-WebGL-Forward-Plus-and-Clustered-Deferred/)

### Demo Video/GIF

<img src="img/demogif.gif" width="700">

### Features
  * Forward+ Shading
  * Clustered Deferred Shading
  * Blinn Phong Shading
  * Optimize G-Buffer Format - 2-component normal
  
  
### Forward+
<img src="img/Screenshot (65).png" width="500">
  
  
###  Clustered Deferred
Position          |   Normal
:-------------------------:|:-------------------------:
<img src="img/Screenshot (73).png" width="500">| <img src="img/Screenshot (75).png" width="500"> |

### Performance Analysis
Position          |   Normal
:-------------------------:|:-------------------------:
<img src="img/chart1.PNG" width="500">| <img src="img/chart2.PNG" width="500"> |


### Bloopers and Debug Images
<img src="img/blooper1.png" width="250">| <img src="img/blooper2.png" width="250"> | <img src="img/blooper3.png" width="250">

### Credits

* [Three.js](https://github.com/mrdoob/three.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [stats.js](https://github.com/mrdoob/stats.js) by [@mrdoob](https://github.com/mrdoob) and contributors
* [webgl-debug](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group Inc.
* [glMatrix](https://github.com/toji/gl-matrix) by [@toji](https://github.com/toji) and contributors
* [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) by [@shrekshao](https://github.com/shrekshao)
* [Compact Normal Storage for small G-Buffers](https://aras-p.info/texts/CompactNormalStorage.html#method03spherical)
