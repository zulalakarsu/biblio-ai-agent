declare module 'json2csv' {
  export class Parser {
    constructor(options?: { fields?: any[] })
    parse(data: any[]): string
  }
}

