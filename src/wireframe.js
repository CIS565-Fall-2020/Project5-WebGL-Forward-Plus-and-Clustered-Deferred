import { gl } from './init';
import { mat4 } from 'gl-matrix';
import { loadShaderProgram } from './utils';
import vsSource from './shaders/wireframe.vert.glsl';
import fsSource from './shaders/wireframe.frag.glsl';

// LOOK: use the Wireframe class to draw arbitrary lines in your scene.
// This can be helpful for visual debugging.
export default class Wireframe {
  constructor() {
    // Initialize a shader program.
    this._shaderProgram = loadShaderProgram(vsSource, fsSource, {
      uniforms: ['u_viewProjectionMatrix'],
      attribs: ['a_position', 'a_color'],
    });

    this._projectionMatrix = mat4.create();
    this._viewMatrix = mat4.create();
    this._viewProjectionMatrix = mat4.create();

    this._attributesNeedUpdate = false;
    this._positions = [];
    this._colors = [];
    this._vertexAttributes;
  }

  addLineSegment(startPosition, endPosition, color) {
    this._positions.push(startPosition.slice()); // copy the input arrays
    this._positions.push(endPosition.slice());
    this._colors.push(color.slice());
    this._colors.push(color.slice());
    this._attributesNeedUpdate = true;
  }

  _updateVertexData() {
    var flatVertices = [];
    for (var i = 0; i < this._positions.length; i++) {
      flatVertices.push(this._positions[i][0]);
      flatVertices.push(this._positions[i][1]);
      flatVertices.push(this._positions[i][2]);

      flatVertices.push(this._colors[i][0]);
      flatVertices.push(this._colors[i][1]);
      flatVertices.push(this._colors[i][2]);
    }

    var vertexAttributes = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexAttributes);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatVertices), gl.STATIC_DRAW);

    this._vertexAttributes = vertexAttributes;
    this._attributesNeedUpdate = false;
  }

  render(camera) {
    if (this._positions.length === 0) {
      return; // don't bother with all the GL calls
    }

    if (this._attributesNeedUpdate) {
      this._updateVertexData();
    }

    // Update the camera matrices
    camera.updateMatrixWorld();
    mat4.invert(this._viewMatrix, camera.matrixWorld.elements);
    mat4.copy(this._projectionMatrix, camera.projectionMatrix.elements);
    mat4.multiply(this._viewProjectionMatrix, this._projectionMatrix, this._viewMatrix);    

    // Bind the default null framebuffer which is the screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Render to the whole screen
    gl.viewport(0, 0, canvas.width, canvas.height);

    // DON'T Clear the frame - we want to draw the wireframe on the scene.
    //gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use this shader program
    gl.useProgram(this._shaderProgram.glShaderProgram);

    // Upload the camera matrix
    gl.uniformMatrix4fv(this._shaderProgram.u_viewProjectionMatrix, false, this._viewProjectionMatrix);

    // set up vertex attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexAttributes);
    gl.enableVertexAttribArray(this._shaderProgram.a_position);
    gl.enableVertexAttribArray(this._shaderProgram.a_color);

    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
    gl.vertexAttribPointer(
      this._shaderProgram.a_position, 
      3, // number of components
      gl.FLOAT, // data type of each component
      false, // normalized?
      3 * 2 * 4, // byte stride of each position - 6 floats, 4 bytes each
      0 // byte offset
    );

    gl.vertexAttribPointer(
      this._shaderProgram.a_color, 
      3, // number of components
      gl.FLOAT, // data type of each component
      false, // normalized?
      3 * 2 * 4, // byte stride of each position - 6 floats, 4 bytes each
      3 * 4  // byte offset - colors and positions are interleaved
    );

    // Drawing without indices
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/drawArrays
    gl.drawArrays(gl.LINES, 0, this._positions.length);
  }
}
