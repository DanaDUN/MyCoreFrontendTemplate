// ===  CSRF Token 設定 ===
const token = document.getElementById("RequestVerificationToken").value;

// ===  全域變數定義 ===
let selectedIndex = -1;
let justSelected = false;
let isBlurring = false;

// #region = BASIC = 檢查字數長度函式 ===
function truncateByByte(str, maxBytes) {
    let total = 0;
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];                                    // 取得當前字元
        const charByte = char.charCodeAt(0) > 255 ? 2 : 1;      // 判斷字元的位元組大小
        if (total + charByte > maxBytes) break;                 // 超過限制則停止
        result += char;                                         // 累加字元
        total += charByte;                                      // 累加位元組大小
    }
    return result;
}
function applyByteLimitToInputs() {
    document.querySelectorAll('input[data-byte-limit]').forEach(input => {  // 選取所有有 data-byte-limit 屬性的 input 元素
        input.addEventListener('input', function () {                       // 綁定 input 事件
            const maxBytes = parseInt(this.dataset.byteLimit, 10);          // 取得最大位元組數
            const trimmed = truncateByByte(this.value, maxBytes);           // 截斷字串
            if (this.value !== trimmed) {                                   // 如果值有變更
                this.value = trimmed;                                       // 更新 input 值
            }
        });
    });
}
// #endregion

// #region = BASIC = 防抖函式 (Debounce) ===
function debounce(fn, delay = 250) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}
// #endregion

// #region === 載入下拉式選單 ===
function loadSelectOptions(selectId, url, placeholderText = null) {
    const $select = $(selectId);
    $select.empty();

    if (placeholderText != null) {
        $select.append($('<option>').val('').text(placeholderText));
    }

    return $.ajax({
        url: url,
        type: 'POST',
        headers: { "RequestVerificationToken": token },
        success: function (res) {
            if (res.success && Array.isArray(res.list)) {
                $.each(res.list, function (i, item) {
                    $select.append($('<option>').val(item.Value).text(item.Text));
                });
            } else {
                toastr.warning('載入清單失敗');
            }
        },
        error: function () {
            toastr.error('無法載入清單');
        }
    });
}
// #endregion

// === fn.查詢條件取值 ===
function getSearchParams() {
    return {
        name: $("#searchName").val().trim() || null,
        no: $("#searchNo").val().trim() || null
    };
}

// #region === fn.模糊搜尋功能 ===
function showAutoCompleteList(selector, suggestions) {
    const $input = $(selector);
    $(".autocomplete-list").remove();
    selectedIndex = -1;

    if (!suggestions || suggestions.length === 0) return;

    const inputOffset = $input.offset();
    const $list = $("<div class='autocomplete-list'></div>").css({
        position: "absolute",
        zIndex: 999,
        background: "#fff",
        border: "1px solid #ccc",
        width: $input.outerWidth(),
        top: inputOffset.top + $input.outerHeight() + 2,
        left: inputOffset.left
    }).appendTo("body");

    suggestions.forEach((item, index) => {
        $("<div>")
            .addClass("autocomplete-item")
            .attr("data-index", index)
            .text(item)
            .on("click", function () {
                $input.val(item);
                $list.remove();
                $input.trigger("change").blur();
            })
            .appendTo($list);
    });
}
// #endregion

// #region === fn.模糊搜尋 AJAX 呼叫 ===
function setupAutoSuggest(inputSelector, suggestUrl) {
    const input = document.querySelector(inputSelector);
    input.addEventListener("input", debounce(function () {
        const keyword = this.value.trim();
        const filter = getSearchParams();
        if (keyword.length < 1) {
            $(".autocomplete-list").remove();
            return;
        }
        $.ajax({
            url: suggestUrl,
            type: "POST",
            contentType: "application/json",
            headers: { "RequestVerificationToken": token },
            data: JSON.stringify(filter),
            success: function (res) {
                if (res.success) {
                    showAutoCompleteList(inputSelector, res.suggestions);
                }
            }
        });
    }, 250));
}
// #endregion

// #region === doc.模糊搜尋 鍵盤控制下拉選單 ===
$(document).off("keydown.autocomplete").on("keydown.autocomplete", function (e) {
    const $items = $(".autocomplete-item");

    if ($items.length === 0) {
        if (e.key === "Enter" && justSelected) {
            justSelected = false;
            if (document.activeElement.matches("input")) {
                document.activeElement.blur(); // 二次 Enter 觸發 change
            }
        }
        return;
    }

    if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < $items.length - 1) selectedIndex++;
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) selectedIndex--;
    } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const $targetItem = $items.eq(selectedIndex);
        const value = $targetItem.text();
        const $input = $("input:focus");

        $input.val(value);
        $(".autocomplete-list").remove();
        justSelected = true;

        $input.trigger("change").blur();
        return;
    } else {
        return;
    }

    $items.removeClass("active");
    $items.eq(selectedIndex).addClass("active");

    const activeItem = $items.eq(selectedIndex)[0];
    if (activeItem && activeItem.scrollIntoView) {
        activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
});
// #endregion

// === btn.清除查詢按鈕 ===
function CleanAllFilter() {
    document.querySelectorAll('.search-filter').forEach(function (element) {
        if (element.tagName === 'INPUT') {
            if (element.type === 'checkbox') {
                element.checked = false; // 清除勾選
            } else {
                element.value = ''; // 清除文字輸入
            }
        } else if (element.tagName === 'SELECT') {
            element.value = ''; // 重置選擇
        }
    });
    $(".autocomplete-list").remove();
}
$("#btnClearFilter").on("click", function () {
    CleanAllFilter();
    myTable.table.clearData();
});

// === !!! * ready 綁定 * ===
$(function () {
    // 綁定字數檢查
    applyByteLimitToInputs();
    // 綁定 Change 觸發查詢
    setupAutoSuggest("#searchNo", LoadSuggestNameUrl);
    $(".search-filter").on("change", function () {
        loadMainTable();
    });
});

// #region === fn.表格用：格式化與排序工具 ===
function customDateSorter(a, b) {
    return new Date(a) - new Date(b);
}
function formatDate(dateString) {
    if (!dateString) return ""; // 處理 null、undefined、空字串
    const date = new Date(dateString);
    if (isNaN(date)) return ""; // 處理無效日期
    return date.toLocaleDateString('zh-TW');
}
// #endregion

// #region === fn.表格用：更新分頁筆數顯示 ===
function updatePaginationInfo(tabulatorInstance) {
    const allData = tabulatorInstance.getData();
    const filteredData = tabulatorInstance.getData("active");

    const text = filteredData.length === allData.length
        ? `共 ${allData.length} 筆`
        : `篩選後共 ${filteredData.length} 筆 / 全部 ${allData.length} 筆`;

    const paginator = document.querySelector(`#${tabulatorInstance.element.id} .tabulator-paginator`);
    if (paginator) {
        let infoBox = paginator.querySelector(".custom-page-info");
        if (!infoBox) {
            infoBox = document.createElement("div");
            infoBox.className = "custom-page-info";
            Object.assign(infoBox.style, {
                marginRight: "auto",
                fontSize: "0.9rem",
                alignSelf: "center",
                paddingLeft: "8px"
            });
            paginator.style.display = "flex";
            paginator.insertBefore(infoBox, paginator.firstChild);
        }
        infoBox.innerText = text;
    }
}
// #endregion

// #region === fn.表格用：初始化欄位filter ===
function createDateColumn(title, field, enableHeaderFilter = false) {
    const col = {
        title,
        field,
        headerSort: true,
        sorter: customDateSorter,
        formatter: function (cell) {
            // 格式化日期，只顯示日期部分
            return formatDate(cell.getValue());
        }
    };
    if (enableHeaderFilter) {
        col.headerFilter = "input";
        col.headerFilterPlaceholder = "搜尋...";
        col.headerFilterFunc = function (headerValue, rowValue) {
            if (!headerValue) return true;
            // 將資料庫日期轉為格式化後的值進行比對
            const firmattedRowValue = formatDate(rowValue);
            setTimeout(updatePaginationInfo, 0);
            return firmattedRowValue.includes(headerValue);
        };
    }
    return col;
}
function createTextColumn(title, field, enableHeaderFilter = false) {
    const col = {
        title,
        field,
        headerSort: true // 保留排序功能
    };
    if (enableHeaderFilter) {
        col.headerFilter = "input";
        col.headerFilterPlaceholder = "搜尋...";
        col.headerFilterFunc = function (headerValue, rowValue) {
            if (!headerValue) return true;
            if (rowValue == null) return false;
            // 文字篩選條件
            const match = !headerValue || rowValue.toLowerCase().includes(headerValue.toLowerCase());
            setTimeout(updatePaginationInfo, 0);
            return match;
        };
    }
    return col;
}
function createNumberColumn(title, field, enableHeaderFilter = false) {
    const col = {
        title,
        field,
        headerSort: true // 保留排序功能
    };
    if (enableHeaderFilter) {
        col.headerFilter = "input";
        col.headerFilterPlaceholder = "搜尋...";
        col.headerFilterFunc = function (headerValue, rowValue) {
            if (!headerValue) return true;
            // 將輸入的值轉為字串+模糊比對
            return (rowValue ?? '').toString().includes(headerValue.toString());
        };
    }
    return col;
}
function createHiddenColumn(title, field) {
    return {
        ...createTextColumn(title, field),
        visible: false
    };
}

// #endregion

// #region === fn.表格用：操作欄位 ===
function createActionColumn(editCallback, deleteCallback) {
    return {
        title: "操作",
        formatter: () =>
            `<button class='btn btn-sm text-primary py-0 px-1 btn-editEven'>
                <i class="bi bi-pencil-fill"></i>
             </button>
             <button class='btn btn-sm text-danger py-0 px-1 btn-deleteEven'>
                <i class="bi bi-trash-fill"></i>
             </button>`,
        width: 65, // 自行調整寬度
        hozAlign: "center",
        headerSort: false,
        cellClick: (e, cell) => {
            const $target = $(e.target);
            const rowData = cell.getRow().getData();

            if ($target.closest(".btn-editEven").length) {
                editCallback(rowData);
            } else if ($target.closest(".btn-deleteEven").length) {
                deleteCallback(rowData);
            }
        }
    };
}
// #endregion

// #region === fn.表格用：初始化共用函示 ===
function initTabulatorTable({ tableId, columns, loadUrl, maxHeight = 500, placeholder = null, minHeight = null, showFooter = true }) {
    const tabulator = new Tabulator(`#${tableId}`, {
        data: [],
        maxHeight: maxHeight,
        minHeight: minHeight,
        placeholder: placeholder,
        pagination: showFooter ? "local" : false,
        paginationSize: 25,
        paginationSizeSelector: [10, 25, 50, 100],
        columns: columns,

        ajaxResponse: (url, params, response) => {
            if (response?.success && Array.isArray(response.data)) {
                if (showFooter) {
                    setTimeout(updatePaginationInfo, 0);
                    setTimeout(() => updatePaginationInfo(tabulator), 0);
                }
                return response.data;
            }
            return [];
        },

        paginationChanged: () => updatePaginationInfo(tabulator),
        pageSizeChanged: () => updatePaginationInfo(tabulator),
        dataFiltered: () => updatePaginationInfo(tabulator),
        renderComplete: () => updatePaginationInfo(tabulator)
    });

    if (showFooter) {
        tabulator.on("dataFiltered", () => setTimeout(() => updatePaginationInfo(tabulator), 0));
    }

    // 載入資料 (支援彈性dataObject)
    function loadTableData(dataObj = null, customUrl = null) {
        $("#tableLoading").show();

        $.ajax({
            url: customUrl || loadUrl,
            type: "POST",
            contentType: "application/json",
            headers: { "RequestVerificationToken": token },
            data: dataObj ? JSON.stringify(dataObj) : null,
            success: function (res) {
                if (res.success) {
                    tabulator.setData(res.data || []);
                } else {
                    tabulator.clearData();
                }
            },
            error: function () {
                tabulator.clearData();
                toastr.error('表格內容載入失敗');
            },
            complete: function () {
                $("#tableLoading").hide();
            }
        });
    }
    return { table: tabulator, loadData: loadTableData };
}
// #endregion

// #region === tb.初始化 表格 ===
const MyColumns = [
    createTextColumn("姓名", "NAME", true),
    createNumberColumn("編號", "NO", true)
];
const MyTable = initTabulatorTable({
    tableId: "tbMyTable",
    columns: MyColumns,
    loadUrl: LoadTableUrl,
    showFooter: false,
    maxHeight: 250,
    minHeight: 250
});
// #endregion

// #region === fn.表格用：載入主表格資料 ===
function loadMainTable() {
    const filter = getSearchParams();
    MyTable.loadData(filter);
}
// #endregion
