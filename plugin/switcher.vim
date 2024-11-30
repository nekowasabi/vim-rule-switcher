function! GetRulesName(arglist, cmdline, cursorpos) abort
  " g:switch_ruleからファイルを読み込む
  let l:rule = g:switch_rule
  let l:file = readfile(l:rule)
  
  " JSONデータを文字列として結合
  let l:json_str = join(l:file, "\n") 
  
  " JSONをデコード
  let l:data = json_decode(l:json_str)
  
  " nameの配列を作成
  let l:names = []
  for condition in l:data.conditions
    call add(l:names, condition.name)
  endfor
  
  return l:names
endfunction
