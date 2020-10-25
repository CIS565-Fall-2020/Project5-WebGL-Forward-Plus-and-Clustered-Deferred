export default function(params) {
	return `#version 310 es
	precision highp float;

	uniform sampler2D u_gbuffers[${params.numGBuffers}];
	uniform sampler2D u_depth;

	in vec2 v_uv;

	out vec4 fragColor;

	void main() {
		// TODO: extract data from g buffers and do lighting
		// vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
		// vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
		// vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
		// vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

		/*fragColor = vec4(vec3(texture(u_gbuffers[2], v_uv).z), 1.0f);*/
		fragColor = (texture(u_gbuffers[0], v_uv) + 1.0f) * 0.5f;
		/*fragColor = texture(u_depth, v_uv);*/
	}
	`;
}
