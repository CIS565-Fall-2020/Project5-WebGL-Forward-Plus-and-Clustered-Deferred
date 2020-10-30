#version 100
precision highp float;

uniform mat4 u_viewProjectionMatrix;
uniform mat4 u_viewMatrix;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;
varying float v_viewDepth;

void main() {
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
    vec4 view = u_viewMatrix * vec4(a_position, 1.0);
    v_viewDepth = -view.z;
    v_position = a_position;
    v_normal = a_normal;
    v_uv = a_uv;
}