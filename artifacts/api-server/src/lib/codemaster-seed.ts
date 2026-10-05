import { db, problemsTable, type InsertProblem } from "@workspace/db";

const starterCode = {
  javascript:
    "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\n// Parse the input, solve the problem, and print the required output.\n",
  python:
    "import sys\ninput_data = sys.stdin.read().strip()\n# Parse the input, solve the problem, and print the required output.\n",
  java:
    "import java.io.*;\nimport java.util.*;\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    Scanner in = new Scanner(System.in);\n    // Parse the input, solve the problem, and print the required output.\n  }\n}\n",
  cpp:
    "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  // Parse the input, solve the problem, and print the required output.\n  return 0;\n}\n",
};

type SeedProblem = Omit<
  InsertProblem,
  "createdBy" | "active" | "starterCode" | "supportedLanguages"
>;

const entries: Array<
  Omit<SeedProblem, "slug"> & { slug: string }
> = [
  {
    slug: "two-sum",
    title: "Two Sum",
    description:
      "Given an integer array and a target, print the indices of two distinct values whose sum equals the target. The input contains n and target on the first line, followed by n integers. Print the smaller index first. Exactly one answer exists.",
    difficulty: "Easy",
    topics: ["Array", "Hash Table"],
    constraints: ["2 <= n <= 100000", "-1,000,000,000 <= value <= 1,000,000,000"],
    examples: [
      { input: "4 9\n2 7 11 15", output: "0 1", explanation: "2 + 7 = 9." },
    ],
    testCases: [{ input: "4 9\n2 7 11 15", output: "0 1" }],
    hiddenTestCases: [{ input: "3 6\n3 2 4", output: "1 2" }],
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    description:
      "Given a string containing only (), {}, and [], determine whether every opening bracket is closed by the same type in the correct order. Print true or false.",
    difficulty: "Easy",
    topics: ["String", "Stack"],
    constraints: ["1 <= string length <= 10000"],
    examples: [
      { input: "()[]{}", output: "true", explanation: "Each bracket pair closes in order." },
    ],
    testCases: [{ input: "()[]{}", output: "true" }],
    hiddenTestCases: [{ input: "(]", output: "false" }],
  },
  {
    slug: "reverse-string",
    title: "Reverse String",
    description:
      "Read one line and print its characters in reverse order. The line may contain spaces.",
    difficulty: "Easy",
    topics: ["String", "Two Pointers"],
    constraints: ["0 <= line length <= 100000"],
    examples: [
      { input: "hello", output: "olleh", explanation: "The characters are reversed." },
    ],
    testCases: [{ input: "hello", output: "olleh" }],
    hiddenTestCases: [{ input: "Code Master", output: "retsaM edoC" }],
  },
  {
    slug: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    description:
      "Given daily stock prices, choose one day to buy and a later day to sell. Print the largest possible profit, or 0 if no profitable trade exists. Input: n, then n prices.",
    difficulty: "Easy",
    topics: ["Array", "Dynamic Programming"],
    constraints: ["1 <= n <= 100000", "0 <= price <= 100000"],
    examples: [
      { input: "6\n7 1 5 3 6 4", output: "5", explanation: "Buy at 1 and sell at 6." },
    ],
    testCases: [{ input: "6\n7 1 5 3 6 4", output: "5" }],
    hiddenTestCases: [{ input: "5\n7 6 4 3 1", output: "0" }],
  },
  {
    slug: "binary-search",
    title: "Binary Search",
    description:
      "Given a sorted array and a target, print the target's index or -1 if it does not occur. Input: n and target, then n sorted integers.",
    difficulty: "Easy",
    topics: ["Array", "Binary Search"],
    constraints: ["1 <= n <= 100000", "The input array is sorted in ascending order."],
    examples: [
      { input: "6 5\n-1 0 3 5 9 12", output: "3", explanation: "The target is at index 3." },
    ],
    testCases: [{ input: "6 5\n-1 0 3 5 9 12", output: "3" }],
    hiddenTestCases: [{ input: "4 2\n1 3 5 7", output: "-1" }],
  },
  {
    slug: "valid-anagram",
    title: "Valid Anagram",
    description:
      "Read two lowercase words and print true if the second is an anagram of the first, otherwise print false.",
    difficulty: "Easy",
    topics: ["String", "Hash Table"],
    constraints: ["1 <= word length <= 50000"],
    examples: [
      { input: "anagram\nnagaram", output: "true", explanation: "Both words contain the same letters." },
    ],
    testCases: [{ input: "anagram\nnagaram", output: "true" }],
    hiddenTestCases: [{ input: "rat\ncar", output: "false" }],
  },
  {
    slug: "contains-duplicate",
    title: "Contains Duplicate",
    description:
      "Given n integers, print true if any value appears at least twice, otherwise print false.",
    difficulty: "Easy",
    topics: ["Array", "Hash Table"],
    constraints: ["1 <= n <= 100000", "-1,000,000,000 <= value <= 1,000,000,000"],
    examples: [
      { input: "4\n1 2 3 1", output: "true", explanation: "The value 1 appears twice." },
    ],
    testCases: [{ input: "4\n1 2 3 1", output: "true" }],
    hiddenTestCases: [{ input: "3\n1 2 3", output: "false" }],
  },
  {
    slug: "maximum-subarray",
    title: "Maximum Subarray",
    description:
      "Given an integer array, find the contiguous non-empty subarray with the largest sum and print that sum.",
    difficulty: "Medium",
    topics: ["Array", "Dynamic Programming"],
    constraints: ["1 <= n <= 100000", "-10000 <= value <= 10000"],
    examples: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4", output: "6", explanation: "The subarray [4, -1, 2, 1] sums to 6." },
    ],
    testCases: [{ input: "9\n-2 1 -3 4 -1 2 1 -5 4", output: "6" }],
    hiddenTestCases: [{ input: "5\n-8 -3 -6 -2 -5", output: "-2" }],
  },
  {
    slug: "merge-two-sorted-lists",
    title: "Merge Two Sorted Lists",
    description:
      "Read two sorted integer lists, each preceded by its length. Print all values in sorted order on one line.",
    difficulty: "Easy",
    topics: ["Linked List", "Two Pointers"],
    constraints: ["0 <= list lengths <= 100000", "Each list is sorted in non-decreasing order."],
    examples: [
      { input: "3\n1 2 4\n3\n1 3 4", output: "1 1 2 3 4 4", explanation: "The two sorted lists are merged." },
    ],
    testCases: [{ input: "3\n1 2 4\n3\n1 3 4", output: "1 1 2 3 4 4" }],
    hiddenTestCases: [{ input: "0\n\n2\n0 5", output: "0 5" }],
  },
  {
    slug: "valid-palindrome",
    title: "Valid Palindrome",
    description:
      "Read a line and check whether it is a palindrome after ignoring non-alphanumeric characters and letter case. Print true or false.",
    difficulty: "Easy",
    topics: ["String", "Two Pointers"],
    constraints: ["0 <= line length <= 200000"],
    examples: [
      { input: "A man, a plan, a canal: Panama", output: "true", explanation: "Ignoring punctuation and case leaves a palindrome." },
    ],
    testCases: [{ input: "A man, a plan, a canal: Panama", output: "true" }],
    hiddenTestCases: [{ input: "race a car", output: "false" }],
  },
  {
    slug: "longest-substring-without-repeating-characters",
    title: "Longest Substring Without Repeating Characters",
    description:
      "Read one line and print the length of its longest substring that contains no repeated character.",
    difficulty: "Medium",
    topics: ["String", "Hash Table", "Sliding Window"],
    constraints: ["0 <= line length <= 100000"],
    examples: [
      { input: "abcabcbb", output: "3", explanation: "The substring abc has length 3." },
    ],
    testCases: [{ input: "abcabcbb", output: "3" }],
    hiddenTestCases: [{ input: "bbbbb", output: "1" }],
  },
  {
    slug: "3sum",
    title: "3Sum",
    description:
      "Find every unique triplet of values that sums to zero. Print each triplet sorted ascending, one per line; sort the lines lexicographically. Input: n followed by n integers.",
    difficulty: "Medium",
    topics: ["Array", "Two Pointers", "Sorting"],
    constraints: ["3 <= n <= 3000", "-100000 <= value <= 100000"],
    examples: [
      { input: "6\n-1 0 1 2 -1 -4", output: "-1 -1 2\n-1 0 1", explanation: "These are the unique zero-sum triplets." },
    ],
    testCases: [{ input: "6\n-1 0 1 2 -1 -4", output: "-1 -1 2\n-1 0 1" }],
    hiddenTestCases: [{ input: "3\n0 0 0", output: "0 0 0" }],
  },
  {
    slug: "product-of-array-except-self",
    title: "Product of Array Except Self",
    description:
      "For every position, print the product of all array values except the value at that position. Do not use division. Input: n followed by n integers.",
    difficulty: "Medium",
    topics: ["Array", "Prefix Sum"],
    constraints: ["2 <= n <= 100000", "The product of any prefix fits in a signed 64-bit integer."],
    examples: [
      { input: "4\n1 2 3 4", output: "24 12 8 6", explanation: "Each output excludes its matching input value." },
    ],
    testCases: [{ input: "4\n1 2 3 4", output: "24 12 8 6" }],
    hiddenTestCases: [{ input: "3\n-1 1 0", output: "0 0 -1" }],
  },
  {
    slug: "group-anagrams",
    title: "Group Anagrams",
    description:
      "Group words that are anagrams. Sort words within each group and sort groups lexicographically. Input: n followed by n lowercase words. Print one group per line.",
    difficulty: "Medium",
    topics: ["Array", "String", "Hash Table"],
    constraints: ["1 <= n <= 10000", "1 <= word length <= 100"],
    examples: [
      { input: "5\neat tea tan ate nat", output: "ate eat tea\nnat tan", explanation: "Words are grouped by their letter counts." },
    ],
    testCases: [{ input: "5\neat tea tan ate nat", output: "ate eat tea\nnat tan" }],
    hiddenTestCases: [{ input: "3\nbat tab cat", output: "bat tab\ncat" }],
  },
  {
    slug: "top-k-frequent-elements",
    title: "Top K Frequent Elements",
    description:
      "Given n integers and k, print the k most frequent distinct values. Break frequency ties by smaller numeric value. Input: n and k followed by n integers.",
    difficulty: "Medium",
    topics: ["Array", "Hash Table", "Heap"],
    constraints: ["1 <= k <= number of distinct values <= n <= 100000"],
    examples: [
      { input: "6 2\n1 1 1 2 2 3", output: "1 2", explanation: "1 and 2 are the two most frequent values." },
    ],
    testCases: [{ input: "6 2\n1 1 1 2 2 3", output: "1 2" }],
    hiddenTestCases: [{ input: "5 2\n4 4 1 1 2", output: "1 4" }],
  },
  {
    slug: "number-of-islands",
    title: "Number of Islands",
    description:
      "Given a grid of 0s and 1s, count connected groups of 1s using horizontal and vertical adjacency only. Input: rows and columns, then one binary string per row.",
    difficulty: "Medium",
    topics: ["Array", "Graph", "Breadth-First Search"],
    constraints: ["1 <= rows, columns <= 500"],
    examples: [
      { input: "4 5\n11110\n11010\n11000\n00000", output: "1", explanation: "All land cells belong to one island." },
    ],
    testCases: [{ input: "4 5\n11110\n11010\n11000\n00000", output: "1" }],
    hiddenTestCases: [{ input: "3 3\n110\n010\n001", output: "2" }],
  },
  {
    slug: "clone-graph",
    title: "Clone Graph",
    description:
      "Read an undirected graph as an adjacency list and print its cloned graph in the same format. Input begins with the node count, then one neighbor list per node. Preserve node labels and sort each printed neighbor list.",
    difficulty: "Medium",
    topics: ["Graph", "Depth-First Search", "Hash Table"],
    constraints: ["0 <= node count <= 100", "Node labels are 1-based."],
    examples: [
      { input: "4\n2 4\n1 3\n2 4\n1 3", output: "2 4\n1 3\n2 4\n1 3", explanation: "The graph structure is preserved in the clone." },
    ],
    testCases: [{ input: "4\n2 4\n1 3\n2 4\n1 3", output: "2 4\n1 3\n2 4\n1 3" }],
    hiddenTestCases: [{ input: "1\n", output: "" }],
  },
  {
    slug: "binary-tree-level-order-traversal",
    title: "Binary Tree Level Order Traversal",
    description:
      "Read a binary tree in level order, using the word null for missing nodes. Print each tree level on its own line. Input begins with the number of tokens.",
    difficulty: "Medium",
    topics: ["Tree", "Breadth-First Search", "Binary Tree"],
    constraints: ["0 <= token count <= 10000"],
    examples: [
      { input: "7\n3 9 20 null null 15 7", output: "3\n9 20\n15 7", explanation: "Values are grouped by their tree depth." },
    ],
    testCases: [{ input: "7\n3 9 20 null null 15 7", output: "3\n9 20\n15 7" }],
    hiddenTestCases: [{ input: "1\n1", output: "1" }],
  },
  {
    slug: "coin-change",
    title: "Coin Change",
    description:
      "Given coin denominations and an amount, print the fewest coins needed to make that amount, or -1 if it is impossible. Input: coin count and amount, then coin values.",
    difficulty: "Medium",
    topics: ["Array", "Dynamic Programming"],
    constraints: ["1 <= coin count <= 100", "0 <= amount <= 100000"],
    examples: [
      { input: "3 11\n1 2 5", output: "3", explanation: "11 can be formed with 5 + 5 + 1." },
    ],
    testCases: [{ input: "3 11\n1 2 5", output: "3" }],
    hiddenTestCases: [{ input: "1 3\n2", output: "-1" }],
  },
  {
    slug: "longest-increasing-subsequence",
    title: "Longest Increasing Subsequence",
    description:
      "Given an integer array, print the length of its longest strictly increasing subsequence. The selected values do not need to be adjacent.",
    difficulty: "Medium",
    topics: ["Array", "Dynamic Programming", "Binary Search"],
    constraints: ["1 <= n <= 100000", "-100000 <= value <= 100000"],
    examples: [
      { input: "8\n10 9 2 5 3 7 101 18", output: "4", explanation: "One longest subsequence is 2, 3, 7, 18." },
    ],
    testCases: [{ input: "8\n10 9 2 5 3 7 101 18", output: "4" }],
    hiddenTestCases: [{ input: "4\n7 7 7 7", output: "1" }],
  },
];

export const seedProblems: Array<InsertProblem> = entries.map((problem) => ({
  ...problem,
  starterCode,
  supportedLanguages: ["javascript", "python", "java", "cpp"],
  active: true,
  createdBy: null,
}));

export async function seedCodeMasterProblems(): Promise<void> {
  await db
    .insert(problemsTable)
    .values(seedProblems)
    .onConflictDoNothing({ target: problemsTable.slug });
}