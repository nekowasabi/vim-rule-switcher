import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as n from "https://deno.land/x/denops_std@v6.5.1/function/nvim/mod.ts";
import * as v from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import {
  ensure,
  is,
  maybe,
} from "https://deno.land/x/unknownutil@v3.18.0/mod.ts";

function calculateWindowDimensions(
  terminalWidth: number,
  terminalHeight: number,
  contentHeight: number,
  windowWidth: number,
) {
  return {
    width: windowWidth,
    height: contentHeight,
    row: Math.floor((terminalHeight - contentHeight) / 2),
    col: Math.floor((terminalWidth - windowWidth) / 2),
  };
}

async function setupWindowOptions(denops: Denops, bufnr: number) {
  await denops.cmd("normal! gg");
  await denops.cmd("set nonumber");
  await n.nvim_buf_set_option(denops, bufnr, "modifiable", false);
  await n.nvim_buf_set_option(denops, bufnr, "wrap", false);
  await n.nvim_buf_set_option(denops, bufnr, "buftype", "nofile");
}

async function setupKeyMappings(denops: Denops, bufnr: number) {
  // 数字キーのマッピング
  for (let i = 0; i <= 9; i++) {
    await n.nvim_buf_set_keymap(
      denops,
      bufnr,
      "n",
      i.toString(),
      `<cmd>call denops#notify('switcher', 'openSelectedFile', [${i}])<CR>`,
      { silent: true },
    );
  }

  // エンターキーのマッピング
  await n.nvim_buf_set_keymap(
    denops,
    bufnr,
    "n",
    "o",
    "<cmd>call denops#notify('switcher', 'openSelectedFile', [line('.') - 1])<CR>",
    { silent: true },
  );

  // 終了キーのマッピング
  await n.nvim_buf_set_keymap(denops, bufnr, "n", "q", "<cmd>fclose!<CR>", {
    silent: true,
  });
}

export async function openFloatingWindow(
  denops: Denops,
  bufnr: number,
  pathWithIndex: string[],
): Promise<void> {
  const terminal_width = Math.floor(
    ensure(await n.nvim_get_option(denops, "columns"), is.Number),
  );
  const terminal_height = Math.floor(
    ensure(await n.nvim_get_option(denops, "lines"), is.Number),
  );
  const floatWinWidth =
    maybe(await v.g.get(denops, "aider_floatwin_width"), is.Number) || 100;

  const dimensions = calculateWindowDimensions(
    terminal_width,
    terminal_height,
    pathWithIndex.length,
    floatWinWidth,
  );

  await n.nvim_open_win(denops, bufnr, true, {
    relative: "editor",
    border: "double",
    ...dimensions,
  });

  await n.nvim_buf_set_lines(denops, bufnr, 0, 0, true, pathWithIndex);
  await setupWindowOptions(denops, bufnr);
  await setupKeyMappings(denops, bufnr);
} 