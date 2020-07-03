import {
  OctokitCreateCheckResponse,
  OctokitRequestOptions,
  OctokitPlugin,
  Octokit,
  RequestDescriptor,
} from '../../types';

// type Hook<O, R, E> = import('before-after-hook').HookSingular<O, R, E>;

let CREATE_CHECK_ID = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SERIALIZER_MAP = new Map<any, any>();

type Serializer = {
  serialize: (
    requestOptions: OctokitRequestOptions,
  ) => Promise<RequestDescriptor>;
  deserialize: (
    descriptor: RequestDescriptor,
    octokit: Parameters<OctokitPlugin>[0],
  ) => ReturnType<Octokit['request']>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Serializers = new Map<string, Serializer>([
  [
    '/repos/{owner}/{repo}/check-runs',
    {
      async serialize(
        requestOptions: OctokitRequestOptions,
      ): Promise<RequestDescriptor> {
        CREATE_CHECK_ID += 1;

        const result = {
          data: {
            id: CREATE_CHECK_ID,
            output: {
              annotations_count:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (requestOptions as any).output?.annotations?.length || 0,
            },
          },
        };

        SERIALIZER_MAP.set(CREATE_CHECK_ID, result);

        return {
          request: {
            ...requestOptions,
            request: undefined,
          },
          result,
        };
      },
      async deserialize(
        descriptor: RequestDescriptor,
        octokit: Parameters<OctokitPlugin>[0],
      ): Promise<OctokitCreateCheckResponse> {
        const result = await octokit.request(descriptor.request);
        // we need to map the id so future requests to updata can be modified
        SERIALIZER_MAP.set(descriptor.result.data.id, result);
        return result;
      },
    },
  ],
  [
    '/repos/{owner}/{repo}/check-runs/{check_run_id}',
    {
      async serialize(
        requestOptions: OctokitRequestOptions,
      ): Promise<RequestDescriptor> {
        const createCheckResult = SERIALIZER_MAP.get(
          requestOptions.check_run_id,
        );

        if (!createCheckResult) {
          throw new Error(
            `[SerializerOctokitPlugin] | Failed to Serialize a check update request, no id "${requestOptions.check_run_id}" was found`,
          );
        }

        createCheckResult.data.output.annotation_count +=
          (requestOptions as any).output?.annotations?.length || 0;

        const result = {
          ...createCheckResult,
          data: {
            ...createCheckResult.data,
            id: requestOptions.check_run_id,
          },
        };

        return {
          request: {
            ...requestOptions,
            request: undefined,
          },
          result,
        };
      },
      async deserialize(
        { request }: RequestDescriptor,
        octokit: Parameters<OctokitPlugin>[0],
      ): Promise<OctokitCreateCheckResponse> {
        const createCheckResult = SERIALIZER_MAP.get(request.check_run_id);

        if (!createCheckResult) {
          throw new Error(
            `[SerializerOctokitPlugin] | Failed to Deserialize a check update request, no id "${request.check_run_id}" was found`,
          );
        }

        request.check_run_id = createCheckResult.data.id;

        const result = await octokit.request(request);

        return result;
      },
    },
  ],
]);
