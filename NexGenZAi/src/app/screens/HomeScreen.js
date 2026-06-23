import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
// Modern, non-deprecated safe area layout handler
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generateImage, getImageHistory } from '../api/images';
import { useAuth } from '../context/AuthContext';
import { getReadableError } from '../utils/errors';

export default function HomeScreen() {
  const { firebaseUser, mongoUser, logout } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false); // Modal state controller
  const listRef = useRef(null);

  // Load user image generation records from DB history on mount
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

  // Smooth auto scroll to base anchor point when messaging layout expands
  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  async function handleGenerate() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || loading) return;

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
        <View style={styles.promptRow}>
          <View style={styles.promptBubble}>
            <Text style={styles.promptText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.imageRow}>
        <View style={styles.aiAvatarWrapper}>
          <Text style={styles.aiAvatarText}>AI</Text>
        </View>
        <View style={styles.imageBubble}>
          <Image source={{ uri: item.imageUrl }} style={styles.generatedImage} resizeMode="cover" />
          <View style={styles.imageActionsRow}>
            <Pressable style={styles.imageActionIcon} hitSlop={8} onPress={() => Alert.alert("Download", "Saving file to device...")}>
              <Ionicons name="download-outline" size={18} color="#64748b" />
            </Pressable>
            <Pressable style={styles.imageActionIcon} hitSlop={8} onPress={() => Alert.alert("Share", "Opening system share drawer...")}>
              <Ionicons name="share-social-outline" size={18} color="#64748b" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        
        {/* ChatGPT Minimal Layout Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerIconBtn} hitSlop={12} onPress={() => Alert.alert("History", "History logs sidebar coming soon.")}>
            <Ionicons name="menu-outline" size={24} color="#0f172a" />
          </Pressable>
          
          <Text style={styles.headerTitle}>NexGenZ<Text style={styles.accentText}>Ai</Text></Text>
          
          <Pressable style={styles.profileMenuBtn} onPress={() => setMenuVisible(true)} hitSlop={8}>
            {!!(mongoUser?.profileImage || firebaseUser?.photoURL) ? (
              <Image source={{ uri: mongoUser?.profileImage || firebaseUser.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person-outline" size={16} color="#475569" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Message Feed Stream */}
        <FlatList
          ref={listRef}
          contentContainerStyle={messages.length ? styles.listContent : styles.emptyListContent}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.logoBadge}>
                <Ionicons name="sparkles" size={28} color="#2563eb" />
              </View>
              <Text style={styles.emptyTitle}>What should we create today?</Text>
              <Text style={styles.emptyText}>
                Describe your ideas in full detail. NexGenZAi will craft optimized visuals instantly.
              </Text>
            </View>
          }
        />

        {/* Progress Processing Strip */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>Engine processing prompt pixels...</Text>
          </View>
        )}

        {/* Dynamic Chat Input Tray */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Pressable style={styles.attachBtn} hitSlop={8} onPress={() => Alert.alert("Upload", "Context image layers selection feature coming soon.")}>
              <Ionicons name="add-circle" size={26} color="#64748b" />
            </Pressable>
            
            <TextInput
              style={styles.input}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Message NexGenZAi..."
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={800}
              editable={!loading}
            />
            
            <Pressable
              style={[styles.sendBtn, (!prompt.trim() || loading) && styles.sendBtnDisabled]}
              disabled={!prompt.trim() || loading}
              onPress={handleGenerate}
            >
              <Ionicons name={loading ? "ellipsis-horizontal" : "arrow-up"} size={18} color="#ffffff" />
            </Pressable>
          </View>
          <Text style={styles.disclaimerText}>NexGenZAi can make mistakes. Verify critical outputs.</Text>
        </View>

        {/* Settings & Profile Slide Up Sheet Modal */}
        <Modal
          visible={menuVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setMenuVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              
              {/* Profile Modal Header -> FIXED: Native View Element */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Profile & Settings</Text>
                <Pressable onPress={() => setMenuVisible(false)} hitSlop={12}>
                  <Ionicons name="close-circle" size={24} color="#94a3b8" />
                </Pressable>
              </View>

              {/* User Metadata Panel Badge */}
              <View style={styles.profileCard}>
                {!!(mongoUser?.profileImage || firebaseUser?.photoURL) ? (
                  <Image source={{ uri: mongoUser?.profileImage || firebaseUser.photoURL }} style={styles.largeAvatar} />
                ) : (
                  <View style={styles.largeAvatarFallback}>
                    <Ionicons name="person" size={32} color="#64748b" />
                  </View>
                )}
                <View style={styles.profileDetails}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {mongoUser?.name || firebaseUser?.displayName || 'NexGenZ Creator'}
                  </Text>
                  <Text style={styles.userEmail} numberOfLines={1}>
                    {mongoUser?.email || firebaseUser?.email}
                  </Text>
                </View>
              </View>

              {/* Functional System Option Elements */}
              <View style={styles.menuGroup}>
                <Pressable style={styles.menuItem} onPress={() => Alert.alert("Account", "Profile editing feature coming soon.")}>
                  <Ionicons name="person-outline" size={20} color="#334155" style={styles.menuItemIcon} />
                  <Text style={styles.menuItemText}>Account Details</Text>
                  <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => Alert.alert("Preferences", "Aspect ratio configuration limits.")}>
                  <Ionicons name="options-outline" size={20} color="#334155" style={styles.menuItemIcon} />
                  <Text style={styles.menuItemText}>Generation Options</Text>
                  <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => Alert.alert("Security", "Firebase Password management profile rules.")}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#334155" style={styles.menuItemIcon} />
                  <Text style={styles.menuItemText}>Security & Privacy</Text>
                  <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                </Pressable>
              </View>

              {/* Secure Firebase/Mongo Destructive Signout Route Button */}
              <Pressable 
                style={({ pressed }) => [styles.modalLogoutBtn, pressed && styles.logoutBtnPressed]} 
                onPress={() => {
                  setMenuVisible(false);
                  logout();
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#b91c1c" style={styles.menuItemIcon} />
                <Text style={styles.logoutButtonText}>Sign Out Account</Text>
              </Pressable>

            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  keyboardView: {
    flex: 1
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerIconBtn: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3
  },
  accentText: {
    color: '#2563eb'
  },
  profileMenuBtn: {
    padding: 2
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0'
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  listContent: {
    paddingVertical: 20
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32
  },
  emptyState: {
    alignItems: 'center',
    marginBottom: 64
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  promptRow: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 20
  },
  promptBubble: {
    backgroundColor: '#f1f5f9',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '80%'
  },
  promptText: {
    color: '#1e293b',
    fontSize: 15,
    lineHeight: 22
  },
  imageRow: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24
  },
  aiAvatarWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4
  },
  aiAvatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800'
  },
  imageBubble: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    maxWidth: '85%'
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8fafc'
  },
  imageActionsRow: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    gap: 12
  },
  imageActionIcon: {
    padding: 2
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500'
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 12,
    backgroundColor: '#ffffff'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  attachBtn: {
    padding: 4,
    marginRight: 4
  },
  input: {
    flex: 1,
    color: '#0f172a',
    fontSize: 15,
    maxHeight: 120,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4
  },
  sendBtnDisabled: {
    backgroundColor: '#e2e8f0'
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 20,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24
  },
  largeAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e2e8f0'
  },
  largeAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  profileDetails: {
    marginLeft: 14,
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2
  },
  menuGroup: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  menuItemIcon: {
    marginRight: 12
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#334155'
  },
  modalLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center'
  },
  logoutBtnPressed: {
    backgroundColor: '#fca5a5'
  },
  logoutButtonText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '600'
  }
});