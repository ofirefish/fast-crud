import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import path from "path";
// https://vitejs.dev/config/
export default {
  plugins: [
    vue(),
    vueJsx({
      // options are passed on to @vue/babel-plugin-jsx
    }),
  ],
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment",
    jsxInject: `import {h} from 'vue'`,
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.js"),
      name: "fast-crud",
    },
    minify: false,
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["vue", "lodash-es", "dayjs", "vue-i18n", "vuedraggable"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          vue: "Vue",
          "lodash-es": "_",
          dayjs: "dayjs",
          "vue-i18n": "VueI18n",
          vuedraggable: "vuedraggable",
        },
      },
    },
  },
};
