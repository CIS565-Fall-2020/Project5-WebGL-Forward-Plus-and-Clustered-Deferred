#version 310 es
precision highp float;

uniform mat4 u_viewProjectionMatrix;

in vec3 a_position;

void main() {
    gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
}
