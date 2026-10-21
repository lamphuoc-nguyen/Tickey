import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ActionFooter, Button, Copy, Field, Heading, QueryState, Screen, c, ui } from '@/components/ui';
import { useCategories, useEvents } from '../hooks/use-catalog';
import { EventCard } from '../components/event-card';
import { useFormDraft } from '@/features/forms/use-form-draft';
export default function SearchScreen() {
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { draft, update } = useFormDraft(`search:${params.categoryId ?? 'all'}`, {
    text: '',
    q: '',
    categoryId: params.categoryId ?? '',
    selectedId: '',
  });
  useEffect(() => {
    const timer = setTimeout(() => update({ q: draft.text.trim() }), 300);
    return () => clearTimeout(timer);
  }, [draft.text, update]);
  const query = useEvents({ q: draft.q, categoryId: draft.categoryId || undefined }),
    categories = useCategories();
  const events = query.data?.pages.flat() ?? [];
  const selected = events.find((e) => e.id === draft.selectedId);
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!selected || !!query.error}
          disabledReason={
            query.error ? 'Chưa thể tải sự kiện. Vui lòng thử lại.' : 'Chọn sự kiện để tiếp tục.'
          }
          onPress={() =>
            selected && router.push({ pathname: '/events/[eventId]', params: { eventId: selected.id } })
          }
        >
          {selected ? `Xem ${selected.title}` : 'Tiếp tục'}
        </ActionFooter>
      }
    >
      <Heading>Tìm sự kiện</Heading>
      <Field
        label="Tên sự kiện"
        placeholder="Tìm sự kiện"
        value={draft.text}
        onChangeText={(text) => update({ text })}
        autoCorrect={false}
        returnKeyType="search"
        style={{ backgroundColor: 'white', borderRadius: 10, borderColor: c.border, minHeight: 48 }}
      />
      <View style={[ui.row, { flexWrap: 'wrap' }]}>
        {[{ id: '', name: 'Tất cả' }, ...(categories.data ?? [])].map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.categoryId === category.id }}
            onPress={() => update({ categoryId: category.id })}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: draft.categoryId === category.id ? c.primaryContainer : c.amberTint,
            }}
          >
            <Copy>{category.name}</Copy>
          </Pressable>
        ))}
      </View>
      <QueryState error={categories.error} retry={() => void categories.refetch()} compact />
      <View style={[ui.row, { alignItems: 'flex-start', flexWrap: 'wrap' }]}>
        {[
          { label: 'Thời gian', reason: 'Lọc theo tháng chưa được hỗ trợ.' },
          { label: 'Địa điểm', reason: 'Lọc theo địa điểm chưa được hỗ trợ.' },
        ].map((filter) => (
          <View key={filter.label} style={{ flex: 1, minWidth: 120, gap: 8 }}>
            <Pressable
              disabled
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityHint={filter.reason}
              style={{ minHeight: 48, padding: 12, borderRadius: 8, backgroundColor: c.blueTint }}
            >
              <Copy style={{ color: c.blue }}>{filter.label}</Copy>
            </Pressable>
            <Copy style={[ui.muted, { fontSize: 12, lineHeight: 19 }]}>{filter.reason}</Copy>
          </View>
        ))}
      </View>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !events.length}
        emptyText="Không tìm thấy sự kiện phù hợp."
      />
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          selected={event.id === draft.selectedId}
          onSelect={() => update({ selectedId: event.id })}
        />
      ))}
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} secondary>
          Xem thêm sự kiện
        </Button>
      )}
    </Screen>
  );
}
