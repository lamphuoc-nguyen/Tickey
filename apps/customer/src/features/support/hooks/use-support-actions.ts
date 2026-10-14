import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { reportInputSchema, type bankInputSchema, type supportInputSchema } from '@event/core';
import type { z } from 'zod';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';

export function useRefund(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['refund', session?.userId, id],
    queryFn: ({ signal }) => repositories.customer.refund(id, signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchInterval: 10000,
  });
}
export function useReport(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['report', session?.userId, id],
    queryFn: ({ signal }) => repositories.customer.report(id, signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
  });
}
export function useSupportRequest(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['support-request', session?.userId, id],
    queryFn: ({ signal }) => repositories.customer.support(id, signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchInterval: 15000,
  });
}
export function useSupportActions() {
  const cache = useQueryClient();
  const uploaded = useRef(new Map<string, string>());
  const { session } = useAuth();
  return {
    pickEvidence: useExclusiveMutation('pick-evidence', {
      mutationFn: async () => {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (result.canceled) return [];
        if (result.assets.some((asset) => (asset.size ?? 0) > 10 * 1024 * 1024))
          throw new Error('Mỗi bằng chứng tối đa 10 MB.');
        return result.assets;
      },
    }),
    report: useExclusiveMutation('submit-report', {
      retry: false,
      mutationFn: async (p: {
        input: Omit<z.input<typeof reportInputSchema>, 'attachmentPaths'>;
        assets: DocumentPicker.DocumentPickerAsset[];
      }) => {
        reportInputSchema.parse({ ...p.input, attachmentPaths: [] });
        const paths: string[] = [];
        for (const asset of p.assets) {
          const key = `${session?.userId}:${asset.uri}`;
          const existing = uploaded.current.get(key);
          if (existing) {
            paths.push(existing);
            continue;
          }
          const form = new FormData();
          form.append('purpose', 'REPORT_EVIDENCE');
          if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, asset.name);
          else
            form.append('file', {
              uri: asset.uri,
              name: asset.name,
              type: asset.mimeType ?? 'application/octet-stream',
            } as unknown as Blob);
          const upload = await repositories.customer.uploadEvidence(form);
          uploaded.current.set(key, upload.path);
          paths.push(upload.path);
        }
        return repositories.customer.submitReport({ ...p.input, attachmentPaths: paths });
      },
      onSuccess: () => {
        void cache.invalidateQueries({ queryKey: ['reports'] });
      },
    }),
    createSupport: useExclusiveMutation('create-support', {
      mutationFn: (input: z.infer<typeof supportInputSchema>) => repositories.customer.createSupport(input),
      onSuccess: () => cache.invalidateQueries({ queryKey: ['support'] }),
    }),
    message: useExclusiveMutation('support-message', {
      mutationFn: (p: { id: string; body: string }) => repositories.customer.supportMessage(p.id, p.body),
      onSuccess: () => {
        void cache.invalidateQueries({ queryKey: ['support-request'] });
        void cache.invalidateQueries({ queryKey: ['support'] });
      },
    }),
    bankInfo: useExclusiveMutation('bank-info', {
      mutationFn: (p: { id: string; input: z.infer<typeof bankInputSchema> }) =>
        repositories.customer.bankInfo(p.id, p.input),
      onSuccess: () => {
        void cache.invalidateQueries({ queryKey: ['refund'] });
        void cache.invalidateQueries({ queryKey: ['refunds'] });
      },
    }),
  };
}
