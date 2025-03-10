/* eslint-disable @typescript-eslint/no-explicit-any */
import * as queryString from 'query-string';
import { ParsedQuery, ParsedUrl, StringifyOptions } from 'query-string';

export * from './isomorphic-fetch';

/**
 * Represents an HTTP method.
 */
export enum HttpMethod {
  GET = 'GET',
  HEAD = 'HEAD',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  CONNECT = 'CONNECT',
  OPTIONS = 'OPTIONS',
  TRACE = 'TRACE',
  PATCH = 'PATCH',
}

/**
 * Represents an HTTP file which will be transferred from or to a server.
 */
export type HttpFile = Blob & { readonly name: string };

/**
 * Represents the body of an outgoing HTTP request.
 */
export type RequestBody = undefined | string | FormData;

export type QueryStyles =
  | 'form'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject';
/**
 * Options are following https://swagger.io/docs/specification/serialization/.
 */
export type SerializerOptions = {
  explode?: boolean;
  queryStyle?: QueryStyles;
};

/**
 * Represents an HTTP request context
 */
export class RequestContext {
  private headers: { [key: string]: string } = {};
  private body: RequestBody = undefined;
  private url: ParsedUrl;

  /**
   * Creates the request context using a http method and request resource url
   */
  public constructor(
    url: string,
    private httpMethod: HttpMethod,
    private opts: SerializerOptions = {},
  ) {
    this.url = queryString.parseUrl(url);
  }

  /**
   * Returns the url set in the constructor including the query string
   */
  public getUrl(): string {
    let arrayFormat: StringifyOptions['arrayFormat'] = 'none';
    let arrayFormatSeparator: StringifyOptions['arrayFormatSeparator'] = ',';

    if (this.opts.explode === false) {
      arrayFormat = 'separator';
      switch (this.opts.queryStyle) {
        case 'spaceDelimited':
          arrayFormatSeparator = ' ';
          break;
        case 'pipeDelimited':
          arrayFormatSeparator = '|';
          break;
        case 'form':
        default:
          arrayFormatSeparator = ',';
          break;
      }
    }
    return queryString.stringifyUrl(this.url, {
      arrayFormat,
      arrayFormatSeparator,
    });
  }

  /**
   * Replaces the url set in the constructor with this url.
   *
   */
  public setUrl(url: string): void {
    this.url = queryString.parseUrl(url);
  }

  /**
   * Sets the body of the http request either as a string or FormData
   *
   * Note that setting a body on a HTTP GET, HEAD, DELETE, CONNECT or TRACE
   * request is discouraged.
   * https://httpwg.org/http-core/draft-ietf-httpbis-semantics-latest.html#rfc.section.7.3.1
   *
   * @param body the body of the request
   */
  public setBody(body: RequestBody): void {
    this.body = body;
  }

  public getHttpMethod(): HttpMethod {
    return this.httpMethod;
  }

  public getHeaders(): { [key: string]: string } {
    return this.headers;
  }

  public getBody(): RequestBody {
    return this.body;
  }

  public setQueryParam(name: string, value: string | string[]): void {
    const queryObj = this.url.query as ParsedQuery<unknown>;
    const currentVal = queryObj[name];
    if (currentVal === undefined) {
      queryObj[name] = value;
      return;
    }
    if (Array.isArray(value)) {
      if (Array.isArray(currentVal)) {
        currentVal.push(...value);
      } else {
        queryObj[name] = [currentVal, ...value];
      }
    } else {
      if (Array.isArray(currentVal)) {
        currentVal.push(value);
      } else {
        queryObj[name] = [currentVal, value];
      }
    }
  }

  /**
   *  Sets a cookie with the name and value. NO check  for duplicate cookies is performed
   *
   */
  public addCookie(name: string, value: string): void {
    if (!this.headers['Cookie']) {
      this.headers['Cookie'] = '';
    }
    this.headers['Cookie'] += name + '=' + value + '; ';
  }

  public setHeaderParam(key: string, value: string): void {
    this.headers[key] = value;
  }
}

export interface ResponseBody {
  text(): Promise<string>;
  binary(): Promise<Blob>;
  json(): Promise<any>;
}

export class ResponseContext {
  public constructor(
    public httpStatusCode: number,
    public headers: { [key: string]: string },
    public body: ResponseBody,
  ) {}

  /**
   * Parse header value in the form `value; param1="value1"`
   *
   * E.g. for Content-Type or Content-Disposition
   * Parameter names are converted to lower case
   * The first parameter is returned with the key `""`
   */
  public getParsedHeader(headerName: string): { [parameter: string]: string } {
    const result: { [parameter: string]: string } = {};
    if (!this.headers[headerName]) {
      return result;
    }

    const parameters = this.headers[headerName].split(';');
    for (const parameter of parameters) {
      let [key, value] = parameter.split('=', 2);
      key = key.toLowerCase().trim();
      if (value === undefined) {
        result[''] = key;
      } else {
        value = value.trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        result[key] = value;
      }
    }
    return result;
  }

  public async getBodyAsFile(): Promise<HttpFile> {
    const data = await this.body.binary();
    const fileName =
      this.getParsedHeader('content-disposition')['filename'] || '';
    const contentType = this.headers['content-type'] || '';
    try {
      return new File([data], fileName, { type: contentType });
    } catch (error) {
      /** Fallback for when the File constructor is not available */
      return Object.assign(data, {
        name: fileName,
        type: contentType,
      });
    }
  }
}

export interface HttpLibrary {
  send(request: RequestContext): Promise<ResponseContext>;
}
