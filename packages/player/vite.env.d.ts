/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
	readonly DEV: boolean;
	readonly MODE: string;
	readonly VITE_YOUTUBE_CLIENT_SECRET?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}