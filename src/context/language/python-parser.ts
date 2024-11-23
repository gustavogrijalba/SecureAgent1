import { AbstractParser, EnclosingContext } from "../../constants";
import Parser = require("tree-sitter");
import Python = require('tree-sitter-python');
import * as fs from 'fs';

export class PythonParser implements AbstractParser {
  private parser: Parser;
  //initialize the python parser using a constructor and setting the lang
  //to python
  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Python);
  }

  //helper function to check if our positions are less than 
  //the lineStart and lineEnd
  private isInRange(line: number, start: number, end: number): boolean {
    return line >= start && line <= end;
  }
  //process each node of the ast
  //similar logic to the javascript-parser.ts file
  private processNode(
    node: Parser.SyntaxNode,
    lineStart: number,
    lineEnd: number,
    largestSize: number,
    largestEnclosingContext: Parser.SyntaxNode | null
  ): { largestSize: number, largestEnclosingContext: Parser.SyntaxNode | null } {
    const {startPosition, endPosition} = node;

    //convert zero based positions to one based 
    //tree sitter, positions in rows and columns are zero based
    const nodeStartLine = startPosition.row + 1;
    const nodeEndLine = endPosition.row + 1;

    //check if we are in range of the linestart and lineend
    if (this.isInRange(lineStart, nodeStartLine, nodeEndLine) && 
    this.isInRange(lineEnd, nodeStartLine, nodeEndLine)) {
      const size = nodeEndLine - nodeStartLine;
      if (size > largestSize) {
        largestSize = size;
        largestEnclosingContext = node;
      }
    }
    return {largestSize, largestEnclosingContext}
  }


  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    const tree = this.parser.parse(file)

    const rootNode = tree.rootNode
    
    let largestEnclosingContext: Parser.SyntaxNode | null;
    let largestSize = 0;

    //recurse the tree to find the enclosing context
    const traverseNode = (node: Parser.SyntaxNode) => {

      if (node.type === 'function_definition' || node.type === 'class_definition') {
        const result = this.processNode(node, lineStart, lineEnd, largestSize, largestEnclosingContext);
        largestSize = result.largestSize;
        largestEnclosingContext = result.largestEnclosingContext;
      }
      //traverse each child node
      node.children.forEach((child) => traverseNode(child))
    };

    //begin recursive traversal of tree
    traverseNode(rootNode);

    //convert to a syntax node
    const convertedNode = largestEnclosingContext
      ? {
          type: largestEnclosingContext.type,
          startLine: largestEnclosingContext.startPosition.row + 1,
          endLine: largestEnclosingContext.endPosition.row + 1,
          text: largestEnclosingContext.text,
        }
      : null;

    return {
      enclosingContext: convertedNode,
    } as EnclosingContext;
  }

  //ensure the file can be parsed
  dryRun(file: string): { valid: boolean; error: string } {
   try {
    this.parser.parse(file)
    return {valid: true, error: ''}
   } catch (exc) {
    return {valid: false, error: exc}
   }
  }
}
