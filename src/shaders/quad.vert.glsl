#version 100
precision highp float;

attribute vec3 a_position;

varying vec2 v_uv;
// get the projection space position in vertex shader
//varying vec3 v_projection_position;

void main() {
    gl_Position = vec4(a_position, 1.0);
    //v_projection_position = vec3(gl_Position.xyz) / gl_Position.w;
    v_uv = a_position.xy * 0.5 + 0.5;
}