import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { generateImage, getImageHistory } from '../api/images';
import { useAuth } from '../context/AuthContext';
import { getReadableError } from '../utils/errors';

export default function HomeScreen() {
  const { firebaseUser, mongoUser, logout } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const images = await getImageHistory();
        const historyMessages = images.flatMap((image) => [
          {
            id: `${image._id}-prompt`,
            type: 'prompt',
            text: image.prompt,
            createdAt: image.createdAt
          },
          {
            id: `${image._id}-image`,
            type: 'image',
            imageUrl: image.imageUrl,
            createdAt: image.createdAt
          }
        ]);

        setMessages(historyMessages);
      } catch (error) {
        console.warn('Unable to load image history:', error.message);
      }
    }

    loadHistory();
  }, []);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  async function handleGenerate() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt || loading) {
      return;
    }

    const promptMessage = {
      id: `prompt-${Date.now()}`,
      type: 'prompt',
      text: cleanPrompt,
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, promptMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const image = await generateImage(cleanPrompt);

      setMessages((current) => [
        ...current,
        {
          id: `image-${image._id || Date.now()}`,
          type: 'image',
          imageUrl: image.imageUrl,
          createdAt: image.createdAt
        }
      ]);
    } catch (error) {
      Alert.alert('Image generation failed', getReadableError(error, 'Unable to generate image right now.'));
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }) {
    if (item.type === 'prompt') {
      return (
        <View style={[styles.messageBubble, styles.promptBubble]}>
          <Text style={styles.promptText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageBubble, styles.imageBubble]}>
        <Image source={{ uri: item.imageUrl }} style={styles.generatedImage} resizeMode="cover" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.header}>
          <View style={styles.profileRow}>
            {!!(mongoUser?.profileImage || firebaseUser?.photoURL) && (
              <Image source={{ uri: mongoUser?.profileImage || firebaseUser.photoURL }} style={styles.avatar} />
            )}
            <View style={styles.profileTextWrap}>
              <Text style={styles.greeting} numberOfLines={1}>
                {mongoUser?.name || firebaseUser?.displayName || 'Creator'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {mongoUser?.email || firebaseUser?.email}
              </Text>
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]} onPress={logout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          contentContainerStyle={messages.length ? styles.listContent : styles.emptyListContent}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>What should we create?</Text>
              <Text style={styles.emptyText}>Try a cinematic product photo, a fantasy landscape, or a clean app illustration.</Text>
            </View>
          }
        />

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.loadingText}>Generating image...</Text>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Describe an image..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={800}
            onSubmitEditing={handleGenerate}
            returnKeyType="send"
          />
          <Pressable
            style={({ pressed }) => [styles.sendButton, (!prompt.trim() || loading) && styles.sendButtonDisabled, pressed && styles.buttonPressed]}
            disabled={!prompt.trim() || loading}
            onPress={handleGenerate}
          >
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  keyboardView: {
    flex: 1
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  profileRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0
  },
  avatar: {
    borderRadius: 20,
    height: 40,
    marginRight: 10,
    width: 40
  },
  profileTextWrap: {
    flex: 1,
    minWidth: 0
  },
  greeting: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800'
  },
  email: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2
  },
  logoutButton: {
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700'
  },
  listContent: {
    padding: 16,
    paddingBottom: 24
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  emptyState: {
    alignItems: 'center'
  },
  emptyTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center'
  },
  messageBubble: {
    borderRadius: 8,
    marginBottom: 14,
    maxWidth: '86%'
  },
  promptBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  promptText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21
  },
  imageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    overflow: 'hidden',
    width: '86%'
  },
  generatedImage: {
    aspectRatio: 1,
    backgroundColor: '#e2e8f0',
    width: '100%'
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  loadingText: {
    color: '#475569',
    fontSize: 13
  },
  inputBar: {
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    padding: 12
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    color: '#111827',
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: 18
  },
  sendButtonDisabled: {
    backgroundColor: '#93c5fd'
  },
  sendText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  buttonPressed: {
    opacity: 0.86
  }
});
