import FsUploaderType from "./type";
export * from "./type";
import { ColumnCompositionProps, CrudOptions, utils } from "@fast-crud/fast-crud";
// @ts-ignore
const asyncModules = import.meta.glob("./components/*.vue");
// @ts-ignore
const syncModules = import.meta.globEager("./components/fs-images-format.vue");

import { useColumns } from "@fast-crud/fast-crud";

const { registerMergeColumnPlugin } = useColumns();

import _ from "lodash-es";
registerMergeColumnPlugin({
  name: "uploader-merge-plugin",
  order: 5,
  handle: (columnProps: ColumnCompositionProps = {}, crudOptions: CrudOptions = {}) => {
    if (typeof columnProps.type === "string" && columnProps.type.endsWith("uploader") && columnProps.buildUrl) {
      const buildUrl = columnProps.buildUrl;
      _.merge(columnProps, {
        form: {
          component: {
            buildUrl
          }
        },
        column: {
          component: {
            buildUrl
          }
        }
      });
    }
    return columnProps;
  }
});

const FsUploaderComponents = {
  install(app) {
    //加载异步组件，异步组件将会被懒加载，所以不用担心打包之后的体积问题
    utils.vite.installAsyncComponents(app, asyncModules, ["FsImagesFormat"], null, null);
    utils.vite.installSyncComponents(app, syncModules, null, null, null);
  }
};

export const FsExtendsUploader = {
  install(app, options) {
    app.use(FsUploaderType, options);
    app.use(FsUploaderComponents);
  }
};
