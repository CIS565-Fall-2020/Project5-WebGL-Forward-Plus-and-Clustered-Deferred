#version 310 es
precision highp float;

out float fragDepth;

void main() {
	fragDepth = gl_FragCoord.z;
}
