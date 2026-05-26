const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.BkeNXv_r.js",app:"_app/immutable/entry/app.ijqatXxL.js",imports:["_app/immutable/entry/start.BkeNXv_r.js","_app/immutable/chunks/BrSNl767.js","_app/immutable/chunks/Sj3nsbfL.js","_app/immutable/chunks/BAONInNm.js","_app/immutable/entry/app.ijqatXxL.js","_app/immutable/chunks/Sj3nsbfL.js","_app/immutable/chunks/B1mfAKfe.js","_app/immutable/chunks/B8nUKCC6.js","_app/immutable/chunks/BHP7VpYD.js","_app/immutable/chunks/CjrWPX-k.js","_app/immutable/chunks/4MuXpNfv.js","_app/immutable/chunks/ZSH5Un2H.js","_app/immutable/chunks/BW8xvNCZ.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-BE3vZB9O.js')),
			__memo(() => import('./chunks/1-C2nGnlGl.js')),
			__memo(() => import('./chunks/2-DM-5EJYY.js')),
			__memo(() => import('./chunks/3-B4gznVN1.js')),
			__memo(() => import('./chunks/4-BHwlW_1O.js')),
			__memo(() => import('./chunks/5-CbXpgi5P.js')),
			__memo(() => import('./chunks/6-ChVMuiXv.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/bond/[id]",
				pattern: /^\/bond\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/discover",
				pattern: /^\/discover\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/matches",
				pattern: /^\/matches\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/profile",
				pattern: /^\/profile\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
