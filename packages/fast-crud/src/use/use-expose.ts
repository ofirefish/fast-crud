import { Ref, toRaw } from "vue";
import { CrudExpose, OpenDialogProps } from "../d.ts/expose";
import _ from "lodash-es";
import logger from "../utils/util.log";
import { useMerge } from "../use/use-merge";
import { useUi } from "../use/use-ui";
import { useI18n } from "../locale";
import { ColumnProps, CrudBinding, PageQuery, PageRes, DoRemoveProps, UserPageQuery, UserPageRes } from "/src/d.ts";
import { useFormWrapper } from "./use-form";

const { merge } = useMerge();

export type UseExposeProps = {
  crudRef: Ref;
  crudBinding: Ref<CrudBinding>;
};

export type UseExposeRet = {
  expose: CrudExpose;
  crudExpose: CrudExpose;
};

export type UseEditableProps = {
  crudExpose: CrudExpose;
};

export type EditableOnEnabledProps = {
  editable: any;
};

function useEditable(props: UseEditableProps) {
  const { crudExpose } = props;
  const { crudBinding } = crudExpose;
  const { ui } = useUi();
  const { t } = useI18n();
  const editable = {
    /**
     * 启用编辑
     * @param opts
     * @param onEnabled 默认根据mode切换rowHandle.active,[editRow,editable]
     */
    async enable(opts: any, onEnabled: (opts: EditableOnEnabledProps) => void) {
      const editableOpts = crudBinding.value.table.editable;
      _.merge(editableOpts, { enabled: true }, opts);
      if (onEnabled) {
        onEnabled({ editable: editableOpts });
      } else {
        if (editableOpts.mode === "row") {
          crudBinding.value.rowHandle.active = "editRow";
        } else {
          crudBinding.value.rowHandle.active = "editable";
        }
      }
    },
    /**
     * 禁用编辑
     */
    disable() {
      crudExpose.getTableRef()?.editable.resume();
      crudBinding.value.table.editable.enabled = false;
      crudBinding.value.rowHandle.active = "default";
    },
    /**
     * 激活所有编辑
     */
    active() {
      crudExpose.getTableRef().editable.active();
    },
    /**
     * 退出编辑
     */
    inactive() {
      crudExpose.getTableRef().editable.inactive();
    },
    /**
     * 添加行
     */
    addRow(opts: any) {
      crudExpose.getTableRef().editable.addRow(opts);
    },
    editCol(opts: any) {
      crudExpose.getTableRef().editable.editCol(opts);
    },
    /**
     * 还原，取消编辑
     */
    resume() {
      crudExpose.getTableRef().editable.resume();
    },
    removeRow(index: number) {
      crudExpose.getTableRef().editable.removeRow(index);
    },
    getEditableRow(index: number) {
      return crudExpose.getTableRef()?.editable?.getEditableRow(index);
    },
    async doSaveRow(opts: { index: number }) {
      const { index } = opts;
      const editableRow = editable.getEditableRow(index);
      editableRow.save({
        index,
        async doSave(opts: { isAdd: boolean; changed: boolean; row: any; setData: (data: any) => void }) {
          const { isAdd, changed, row, setData } = opts;
          if (crudBinding.value?.mode?.name === "local") {
            return;
          }
          try {
            editableRow.isLoading = true;
            if (isAdd) {
              const ret = await crudBinding.value.request.addRequest({ form: changed });
              setData(ret);
            } else {
              await crudBinding.value.request.editRequest({ form: changed, row });
            }
          } finally {
            editableRow.isLoading = false;
          }
        }
      });
    },
    async doCancelRow(opts: { index: number }) {
      const { index } = opts;
      const editableRow = editable.getEditableRow(index);
      editableRow.inactive();
    },
    async doRemoveRow(opts: { index: number }) {
      const { index } = opts;
      try {
        await ui.messageBox.confirm({
          title: t("fs.rowHandle.remove.confirmTitle"), // '提示',
          message: t("fs.rowHandle.remove.confirmMessage"), // '确定要删除此记录吗?',
          type: "warn"
        });
      } catch (e) {
        // @ts-ignore
        logger.info("delete canceled", e.message);
        return;
      }
      const row = editable.getEditableRow(index);
      if (row.isAdd) {
        editable.removeRow(index);
      } else {
        if (crudBinding.value.mode.name === "local") {
          // do nothing
        } else {
          const rowData = row.getRowData(index);
          await crudBinding.value.request.delRequest({ row: rowData });
          crudExpose.doRefresh();
        }
      }
      ui.notification.success(t("fs.rowHandle.remove.success"));
    },
    getInstance() {
      crudExpose.getTableRef().editable;
    }
  };
  return editable;
}

/**
 *
 * @param props
 */
export function useExpose(props: UseExposeProps): UseExposeRet {
  const { crudRef, crudBinding } = props;
  const { ui } = useUi();
  const { t } = useI18n();

  const formWrapperProvider = useFormWrapper(true);
  function checkCrudRef() {
    if (crudRef.value == null) {
      logger.warn("crudRef还未初始化，请在onMounted之后调用");
    }
  }
  function checkCrudBindingRef() {
    if (crudBinding.value == null) {
      logger.warn("crudBinding还未初始化，请在useFs或useCrud之后调用");
    }
  }

  const crudExpose: CrudExpose = {
    crudRef,
    crudBinding,

    getFormWrapperRef() {
      return crudRef.value.formWrapperRef;
    },
    getFormRef: () => {
      const formWrapperRef = crudExpose.getFormWrapperRef();
      if (formWrapperRef == null || formWrapperRef?.formRef == null) {
        logger.error(
          "当前无法获取FormRef，请在编辑对话框已打开的状态下调用此方法，如果是在打开对话框时调用，可以尝试先nextTick"
        );
        return;
      }
      return formWrapperRef?.formRef;
    },
    getFormData: () => {
      const formRef = crudExpose.getFormRef();
      return formRef?.getFormData();
    },
    getFormComponentRef(key, isAsync = false) {
      const formRef = crudExpose.getFormRef();
      return formRef?.getComponentRef(key, isAsync);
    },
    doValueBuilder(records, columns) {
      if (columns == null) {
        columns = toRaw(crudBinding.value.columns);
      }
      logger.debug("doValueBuilder ,columns=", columns);
      const valueBuilderColumns = _.filter(columns, (column) => {
        return column.valueBuilder != null;
      });
      if (valueBuilderColumns.length === 0) {
        return;
      }
      _.forEach(records, (row, index) => {
        _.forEach(valueBuilderColumns, (builder) => {
          builder.valueBuilder({
            value: row[builder.key],
            row,
            index,
            key: builder.key,
            column: builder.column
          });
        });
      });
      logger.debug("valueBuilder success:", records);
    },
    doValueResolve({ form }, columns) {
      if (columns == null) {
        columns = toRaw(crudBinding.value.columns);
      }
      logger.debug("doValueResolve ,columns=", columns);
      _.forEach(columns, (column: ColumnProps, key) => {
        if (column.valueResolve) {
          column.valueResolve({
            value: form[key],
            row: form,
            form,
            key,
            column
          });
        }
      });
      logger.debug("valueResolve success:", form);
    },
    getSearchFormData() {
      if (!crudRef.value) {
        return {};
      }
      if (crudRef.value.getSearchFormData) {
        return crudRef.value.getSearchFormData();
      }
      return {};
    },
    /**
     * {form,mergeForm}
     */
    setSearchFormData(context: { form: any; mergeForm?: boolean }) {
      checkCrudRef();
      crudRef.value.setSearchFormData(context);
    },
    /**
     * 获取search组件ref
     */
    getSearchRef() {
      checkCrudRef();
      return crudRef.value.getSearchRef();
    },
    async doRefresh() {
      if (crudBinding.value.request.pageRequest == null) {
        return;
      }

      let page: any;
      if (crudBinding.value.pagination) {
        page = {
          currentPage: crudBinding.value.pagination[ui.pagination.currentPage],
          pageSize: crudBinding.value.pagination.pageSize
        };
      }
      const searchFormData = _.cloneDeep(crudExpose.getSearchFormData());
      //配置searchValueResolve
      if (crudBinding.value?.search?.columns) {
        crudExpose.doValueResolve({ form: searchFormData }, toRaw(crudBinding.value.search.columns));
      }
      crudExpose.doValueResolve({ form: searchFormData });

      const sort = crudBinding.value.sort || {};
      const query: PageQuery = { page, form: searchFormData, sort };
      let userPageQuery: UserPageQuery = query;
      if (crudBinding.value.request.transformQuery) {
        userPageQuery = crudBinding.value.request.transformQuery(query);
      }

      let userPageRes: UserPageRes;
      try {
        crudBinding.value.table.loading = true;
        logger.debug("pageRequest", userPageQuery);
        userPageRes = await crudBinding.value.request.pageRequest(userPageQuery);
      } finally {
        crudBinding.value.table.loading = false;
      }
      if (userPageRes == null) {
        logger.warn("pageRequest返回结果不能为空");
        return;
      }
      let pageRes: PageRes = userPageRes;
      if (crudBinding.value.request.transformRes) {
        pageRes = crudBinding.value.request.transformRes({
          res: userPageRes,
          query: userPageQuery
        });
      }
      const { currentPage = page[ui.pagination.currentPage], pageSize = page.pageSize, total } = pageRes;
      const { records } = pageRes;
      if (records == null || total == null) {
        logger.warn(
          "pageRequest返回结构不正确，请配置正确的request.transformRes，期望：{currentPage, pageSize, total, records:[]},实际返回：",
          pageRes
        );
        return;
      }

      //valueBuild
      crudExpose.doValueBuilder(records);

      crudBinding.value.data = records;
      if (crudBinding.value.pagination) {
        crudBinding.value.pagination[ui.pagination.currentPage] = currentPage;
        crudBinding.value.pagination.pageSize = pageSize;
        crudBinding.value.pagination[ui.pagination.total] = total || records.length;
      }
      if (crudBinding.value?.table?.onRefreshed) {
        crudBinding.value.table.onRefreshed({
          data: records
        });
      }
    },
    doPageTurn(no: number) {
      crudBinding.value.pagination[ui.pagination.currentPage] = no;
    },
    /**
     *
     * @param opts = {
     *   form
     *   goFirstPage =true
     *   mergeForm=false
     * }
     */
    async doSearch(opts: { form?: any; goFirstPage?: boolean; mergeForm?: boolean }) {
      logger.debug("do search:", opts);
      opts = merge({ goFirstPage: true }, opts);
      if (opts.goFirstPage) {
        crudExpose.doPageTurn(1);
      }
      if (opts.form && crudRef.value) {
        crudRef.value.setSearchFormData(opts);
      }

      await crudExpose.doRefresh();
    },
    /**
     * 获取FsTable实例
     */
    getTableRef() {
      checkCrudRef();
      return crudRef.value?.tableRef;
    },
    /**
     * 获取x-Table实例
     */
    getBaseTableRef() {
      const tableRef = this.getTableRef();
      if (tableRef == null) {
        logger.warn("fs-table还未挂载");
        return;
      }
      return tableRef.value.tableRef;
    },
    /**
     * 获取表格数据
     */
    getTableData() {
      checkCrudBindingRef();
      return crudBinding.value.data;
    },
    setTableData(data: any[]) {
      checkCrudBindingRef();
      crudBinding.value.data = data;
    },
    insertTableRow(index: number, row: any) {
      checkCrudBindingRef();
      crudBinding.value.data.splice(index, 0, row);
    },
    updateTableRow(index: number, row: any, merge = true) {
      if (merge) {
        crudBinding.value.data[index] = _.merge(crudBinding.value.data[index], row);
      } else {
        crudBinding.value.data[index] = row;
      }
    },
    removeTableRow(index: number) {
      checkCrudBindingRef();
      crudBinding.value.data.splice(index, 1);
    },
    getTableDataRow(index: number) {
      const data = crudExpose.getTableData();
      if (data == null) {
        throw new Error("table data is not init");
      }
      if (data.length <= index) {
        throw new Error("index over array length");
      }
      return data[index];
    },
    /**
     * 选择某一行
     * @param index
     * @param row
     */
    doSelectCurrentRow({ row }: { row: any }) {
      const tableRef = crudExpose.getTableRef();
      tableRef.value.setCurrentRow(row);
    },
    /**
     * 删除行按钮
     * @param context
     */
    async doRemove(context: DoRemoveProps) {
      const removeBinding: any = crudBinding.value.table.remove ?? {};
      try {
        if (removeBinding.confirmFn) {
          await removeBinding.confirmFn(context);
        } else {
          await ui.messageBox.confirm({
            title: removeBinding.confirmTitle || t("fs.rowHandle.remove.confirmTitle"), // '提示',
            message: removeBinding.confirmMessage || t("fs.rowHandle.remove.confirmMessage"), // '确定要删除此记录吗?',
            type: "warn"
          });
        }
      } catch (e) {
        if (removeBinding.onCanceled) {
          await removeBinding.onCanceled(context);
        }
        return;
      }
      let res = null;
      if (crudBinding.value.mode?.name === "local") {
        crudExpose.removeTableRow(context?.index);
      } else {
        res = await crudBinding.value.request.delRequest(context);
      }

      if (removeBinding.showSuccessNotification !== false) {
        ui.notification.success(t("fs.rowHandle.remove.success"));
      }

      if (removeBinding.refreshTable !== false) {
        await crudExpose.doRefresh();
      }

      if (removeBinding.onRemoved) {
        await removeBinding.onRemoved({ ...context, res });
      }
    },
    /**
     *
     * 打开表单对话框
     * @param context ={mode, initialForm: row, index,...formOptions}
     */
    async openDialog(context: OpenDialogProps) {
      if (context.newInstance === true && formWrapperProvider) {
        //通过新实例打开
        return await formWrapperProvider.openDialog(context);
      }
      const formWrapperRef = this.getFormWrapperRef();
      formWrapperRef.open(context);
      return formWrapperRef;
    },

    async openAdd(context: OpenDialogProps) {
      const mode = "add";
      let row = context.row;
      if (crudBinding.value?.request?.infoRequest) {
        row = await crudBinding.value.request.infoRequest({ mode, row });
      }
      const options = {
        mode,
        initialForm: row || {},
        ...crudBinding.value.addForm
      };
      _.merge(options, context);
      return await this.openDialog(options);
    },
    async openEdit(context: OpenDialogProps) {
      let row = context.row || context[ui.tableColumn.row];
      if (row == null && context.index != null) {
        row = crudExpose.getTableDataRow(context.index);
      }
      const mode = "edit";
      if (crudBinding.value?.request?.infoRequest) {
        row = await crudBinding.value.request.infoRequest({ mode, row });
      }
      const options = {
        mode,
        initialForm: row,
        ...crudBinding.value.editForm
      };
      _.merge(options, context);
      this.getFormWrapperRef().open(options);
    },
    async openView(context: OpenDialogProps) {
      let row = context.row || context[ui.tableColumn.row];
      if (row == null && context.index != null) {
        row = crudExpose.getTableDataRow(context.index);
      }
      const mode = "view";
      if (crudBinding.value?.request?.infoRequest) {
        row = await crudBinding.value.request.infoRequest({ mode, row });
      }
      const options = {
        mode,
        initialForm: row,
        ...crudBinding.value.viewForm
      };
      _.merge(options, context);
      this.getFormWrapperRef().open(options);
    },
    editable: undefined
  };
  crudExpose.editable = useEditable({ crudExpose });
  return { expose: crudExpose, crudExpose: crudExpose };
}
