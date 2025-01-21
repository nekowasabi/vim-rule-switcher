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

To switch between files using the defined rules, use the following Vim command:

You can use the command:

```vim
:SwitchFileByRule [rule] [name]
```

Example usage: 
```
:SwitchFileByRule git switcher<CR>
```

If no `name` is given, the command will cycle through files according to all available rules. If either a `rule` or `name` is specified, it opens the first file associated with that specific rule or name.

Explanation of `rule` types:

- `file`: Switches to the file defined in the rule's path.
- `git`: Uses `%` as a placeholder for the current file, allowing switches based on prefix or postfix rules.

Example of a `git` rule:
Suppose the current file is `main.ts`, and the rule is defined as:

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

This rule will switch between `main.ts` and `mainTest.ts`.

Executing `SwitchFileByRule git` in this context will switch the buffer to `mainTest.ts`, assuming it is tracked in the git repository. Since `git ls-files` is used, specifying the path is unnecessary.

`name`
Specifies the name.

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
