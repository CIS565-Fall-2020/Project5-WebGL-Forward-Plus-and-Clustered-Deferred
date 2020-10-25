#version 100
precision highp float;

uniform mat4 u_viewProjectionMatrix;

attribute vec3 a_position;
attribute vec3 a_color;

varying vec3 v_color;

void main() {
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
    v_color = a_color;
}
