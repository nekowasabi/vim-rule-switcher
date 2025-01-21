# vim-rule-switcher

This Vim plugin provides a convenient way to switch between related files based
on custom rules. It's particularly useful in projects where files of different
types or with different naming conventions are logically related, such as header
and implementation files in C/C++ projects, or component and test files in web
development.

## Breaking Changes
```
The specification of the configuration file has been changed due to the commit on 2025/01/21.
Please check the configuration section and update the json file.
```

## Features

- Define custom switching rules based on file paths, prefixes, and postfixes.
- Easily navigate between related files with a simple Vim command.
- Supports integration with Git to switch between files tracked in the
  repository.

## Requirements

- [denops.vim](https://github.com/vim-denops/denops.vim)

## Installation

You can install vim-rule-switcher using your favorite plugin manager. For
example, with [vim-plug](https://github.com/junegunn/vim-plug):

```vim
Plug 'nekowasabi/vim-rule-switcher'
```

Then run `:PlugInstall` in Vim.

## Configuration

Make json file in `/path/to/example.json`.

```json
{
  "projects": [
    {
      "name": "nvim",
      "rules": [
        {
          "rule": "file",
          "path": [
            "~/.config/nvim/rc/plugin.vim",
            "~/.config/nvim/init.vim"
          ]
        }
      ]
    },
    {
      "name": "switcher",
      "rules": [
        {
          "rule": "file",
          "path": [
            "~/.config/nvim/plugged/vim-rule-switcher/denops/switcher/main.ts",
            "~/.config/nvim/plugged/vim-rule-switcher/denops/switcher/switcher.ts"
          ]
        },
        { 
          "rule": "git",
          "postfix": "Test",
          "path": [
            "%.ts",
            "%Test.ts"
          ]
        }
      ]
    }
  ]
}
```

Define your switching rules in your `.vimrc` or `init.vim` like so:

```vim
let g:switch_rule = "/path/to/example.json"
```

## Usage

To switch between files according to the defined rules, use the following Vim
command:

```vim
:SwitchFileByRule [rule] [name]

ex. :SwitchFileByRule git switcher<CR>
```

If no name argument is provided, it switches between files based on all defined rules.
If a rule or name argument is provided, it will open the first file from the file paths
associated with that specific rule name.

Please check the following for instructions on how to use the site.

`rule`
file: The buffer is switched to the file set as the path in the rule file.
git: 
It recognizes % as the current file name and switches the buffer using prefix or postfix.

Example:
If the currently open file is main.ts and

```json
{
  "rule": "git",
  "postfix": "Test",
  "path": [
    "%.ts",
    "%Test.ts"
  ]
}
```

If you run `SwitchFileByRule git` in this situation,
the buffer will switch to mainTest.ts, which is managed in the git repository. Because git ls-files is used, there is no need to specify the path.

`name`
Set name.

```vim
:SelectSwitchRule
```
This command allows you to choose from the available switch rules and apply the
selected rule to switch files.

If no name argument is provided, it switches between files based on all defined rules.
If a name argument is provided, it will open the first file from the file paths
associated with that specific rule name.

Available keybindings in the selection window:
- 0-9: Select file by number
- q: Quit the selection window  
- o: Open the file under cursor

```vim
:SaveSwitchRule <rule_name>
```

This command will add the current file to the specified rule in the switch rule
json file.

To edit the rules file, use the following command:

```vim
:OpenSwitchRuleFile
```

To edit switch rule directly, use the following command:


## Related Projects

[vim-altr](https://github.com/kana/vim-altr)

## License

This project is licensed under the MIT License - see the LICENSE file for
details.
