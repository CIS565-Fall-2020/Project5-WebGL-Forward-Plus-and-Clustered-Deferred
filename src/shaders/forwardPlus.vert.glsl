#version 100
precision highp float;

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_projectionMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;
// get the projection space position in vertex shader
varying vec3 v_projection_position;

void main() {
    // no model matrix: because it's already in model space
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
    v_projection_position = vec3(gl_Position) / gl_Position.w;
    v_position = a_position;
    v_normal = a_normal;
    v_uv = a_uv;
}