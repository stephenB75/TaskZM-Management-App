import React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

const shortcuts = [
  {
    category: "Navigation",
    items: [
      { keys: ["1"], description: "Go to Dashboard" },
      { keys: ["2"], description: "Go to Inbox" },
      { keys: ["3"], description: "Go to Settings" },
    ],
  },
  {
    category: "Tasks",
    items: [
      { keys: ["N"], description: "Create new task" },
      { keys: ["E"], description: "Edit selected task" },
      { keys: ["D"], description: "Delete selected task" },
      { keys: ["C"], description: "Mark task as complete" },
    ],
  },
  {
    category: "General",
    items: [
      { keys: ["/", "S"], description: "Search tasks" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialog/cancel" },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  return (
    <Dialog>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {shortcuts.map((section, index) => (
            <div key={section.category}>
              {index > 0 && <Separator className="my-4" />}
              <h3 className="mb-3">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {item.description}
                    </span>
                    <div className="flex gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}